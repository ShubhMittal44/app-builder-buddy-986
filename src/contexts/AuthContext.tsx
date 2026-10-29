import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  user_id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'manager' | 'staff';
  avatar_url: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export type ModuleKey = 'orders' | 'inventory' | 'daybook' | 'customer_ledger';
export type PermAction = 'view' | 'add' | 'edit';
type PermMap = Partial<Record<ModuleKey, { view: boolean; add: boolean; edit: boolean }>>;

interface AuthContextType {
  permissions: PermMap;
  can: (module: ModuleKey, action: PermAction) => boolean;
  refreshPermissions: () => Promise<void>;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermMap>({});

  const fetchPermissions = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_module_permissions')
      .select('module_key, can_view, can_add, can_edit')
      .eq('user_id', userId);
    if (error) { console.error('Error fetching permissions:', error); setPermissions({}); return; }
    const map: PermMap = {};
    (data ?? []).forEach((r) => {
      map[r.module_key as ModuleKey] = { view: r.can_view, add: r.can_add, edit: r.can_edit };
    });
    setPermissions(map);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      await fetchPermissions(userId);
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch to avoid blocking auth state changes
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setPermissions({});
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign in');
      setError(error.message);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) throw error;
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send reset email');
      setError(error.message);
      return { error };
    }
  };

  const isAdmin = profile?.role === 'admin' && profile?.is_active !== false;
  const can = (module: ModuleKey, action: PermAction) =>
    isAdmin || (profile?.is_active !== false && !!permissions[module]?.[action]);
  const refreshPermissions = async () => { if (user) await fetchPermissions(user.id); };

  // Pick up admin changes when the user returns to the tab
  useEffect(() => {
    if (!user) return;
    const onFocus = () => { fetchProfile(user.id); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        error,
        isAdmin,
        permissions,
        can,
        refreshPermissions,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
