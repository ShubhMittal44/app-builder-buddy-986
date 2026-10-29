import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Key, UserCheck, LogOut, Package, ArrowLeft, ShieldCheck, Ban, CircleCheck, History } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingStates';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { PermissionMatrix, PermRow, emptyPerms, summarize, MODULES } from '@/components/users/PermissionMatrix';

type Role = 'admin' | 'manager' | 'staff';
interface UserProfile {
  user_id: string;
  email: string;
  display_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}
interface AuditRow {
  id: string; target_email: string | null; action: string; old_value: any; new_value: any; changed_by: string | null; changed_at: string;
}

async function fnError(error: any): Promise<string> {
  let message = error?.message ?? 'Request failed';
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error) message = body.error;
    }
  } catch { /* ignore */ }
  return message;
}

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
};

export default function Users() {
  const { isAdmin, signOut, user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [permsByUser, setPermsByUser] = useState<Record<string, PermRow[]>>({});
  const [loading, setLoading] = useState(true);

  // create
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPass, setCPass] = useState('');
  const [cPass2, setCPass2] = useState('');
  const [cRole, setCRole] = useState<Role>('staff');
  const [cPerms, setCPerms] = useState<PermRow[]>(emptyPerms());

  // role
  const [roleUser, setRoleUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('staff');

  // permissions
  const [permUser, setPermUser] = useState<UserProfile | null>(null);
  const [editPerms, setEditPerms] = useState<PermRow[]>(emptyPerms());
  const [savingPerms, setSavingPerms] = useState(false);

  // audit
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  useEffect(() => { if (!isAdmin) navigate('/', { replace: true }); }, [isAdmin, navigate]);

  const fetchUsers = async () => {
    try {
      const [{ data, error }, { data: perms, error: pErr }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_module_permissions').select('user_id, module_key, can_view, can_add, can_edit'),
      ]);
      if (error) throw error;
      if (pErr) throw pErr;
      setUsers((data || []) as UserProfile[]);
      const map: Record<string, PermRow[]> = {};
      (data || []).forEach((u) => {
        map[u.user_id] = emptyPerms().map((base) => {
          const p = perms?.find((x) => x.user_id === u.user_id && x.module_key === base.module_key);
          return p ? { module_key: base.module_key, can_view: p.can_view, can_add: p.can_add, can_edit: p.can_edit } : base;
        });
      });
      setPermsByUser(map);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  const openCreate = () => {
    const p = generatePassword();
    setCName(''); setCEmail(''); setCPass(p); setCPass2(p); setCRole('staff'); setCPerms(emptyPerms());
    setCreatedCreds(null); setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!cName.trim()) return toast.error('Full name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail.trim())) return toast.error('Enter a valid email address');
    if (cPass.length < 8) return toast.error('Password must be at least 8 characters');
    if (cPass !== cPass2) return toast.error('Passwords do not match');
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email: cEmail.trim(), password: cPass, display_name: cName.trim(), role: cRole, permissions: cRole === 'admin' ? [] : cPerms },
      });
      if (error) throw new Error(await fnError(error));
      if (data?.error) throw new Error(data.error);
      toast.success('User created successfully.');
      setCreatedCreds({ email: cEmail.trim(), password: cPass });
      await fetchUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleChangeRole = async () => {
    if (!roleUser) return;
    if (roleUser.user_id === me?.id && selectedRole !== 'admin') return toast.error('You cannot remove your own Admin role');
    const { error } = await supabase.from('profiles').update({ role: selectedRole }).eq('user_id', roleUser.user_id);
    if (error) { console.error(error); return toast.error('Failed to update role'); }
    toast.success('Role updated successfully');
    setRoleUser(null);
    fetchUsers();
  };

  const handleResetPassword = async (u: UserProfile) => {
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${window.location.origin}/auth/reset-password` });
    if (error) return toast.error('Failed to send reset email');
    toast.success(`Password reset email sent to ${u.email}`);
  };

  const handleToggleActive = async (u: UserProfile) => {
    const { data, error } = await supabase.functions.invoke('admin-set-user-active', { body: { user_id: u.user_id, active: !u.is_active } });
    if (error || data?.error) return toast.error(error ? await fnError(error) : data.error);
    toast.success(u.is_active ? 'User deactivated' : 'User reactivated');
    fetchUsers();
  };

  const openPerms = (u: UserProfile) => { setPermUser(u); setEditPerms(permsByUser[u.user_id] ?? emptyPerms()); };

  const savePerms = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    const before = permsByUser[permUser.user_id] ?? emptyPerms();
    const changed = editPerms.filter((r) => {
      const b = before.find((x) => x.module_key === r.module_key)!;
      return b.can_view !== r.can_view || b.can_add !== r.can_add || b.can_edit !== r.can_edit;
    });
    const { error } = changed.length
      ? await supabase.from('user_module_permissions').upsert(
          changed.map((r) => ({ user_id: permUser.user_id, ...r })),
          { onConflict: 'user_id,module_key' },
        )
      : { error: null };
    setSavingPerms(false);
    if (error) { console.error(error); return toast.error('Unable to update user permissions.'); }
    toast.success('User permissions updated successfully.');
    setPermUser(null);
    fetchUsers();
  };

  const openAudit = async () => {
    setShowAudit(true);
    const { data, error } = await supabase.from('user_admin_audit_log').select('*').order('changed_at', { ascending: false }).limit(200);
    if (error) return toast.error('Failed to load history');
    setAudit((data || []) as AuditRow[]);
  };
  const emailOf = (id: string | null) => users.find((u) => u.user_id === id)?.email ?? (id ? 'Unknown' : 'System');
  const describe = (a: AuditRow) => {
    if (a.action === 'permission_update') {
      const n = a.new_value ?? a.old_value; const m = MODULES.find((x) => x.key === n?.module)?.label ?? n?.module;
      const fmt = (v: any) => v ? ['view', 'add', 'edit'].filter((k) => v[k]).join('/') || 'none' : 'none';
      return `${m}: ${fmt(a.old_value)} → ${fmt(a.new_value)}`;
    }
    if (a.action === 'role_change') return `Role: ${a.old_value?.role} → ${a.new_value?.role}`;
    if (a.action === 'user_created') return `Created as ${a.new_value?.role}`;
    return a.action.replace(/_/g, ' ');
  };

  if (!isAdmin) return null;

  const roleBadge = (r: Role) => <Badge variant={r === 'admin' ? 'destructive' : r === 'manager' ? 'default' : 'secondary'}>{r}</Badge>;

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Back</span>
            </Button>
            <div className="flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              <h1 className="text-lg md:text-xl font-bold">User Management</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Sign Out</span></Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold">Users</h2>
            <p className="text-muted-foreground">Manage accounts, roles and module permissions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openAudit}><History className="w-4 h-4 mr-2" />History</Button>
            <Button onClick={openCreate}><UserPlus className="w-4 h-4 mr-2" />Create User</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.display_name || '—'}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell>{u.is_active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Deactivated</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                      {u.role === 'admin' ? 'Full access' : summarize(permsByUser[u.user_id] ?? emptyPerms())}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" title="Manage Permissions" onClick={() => openPerms(u)}>
                        <ShieldCheck className="w-4 h-4 md:mr-1" /><span className="hidden lg:inline">Manage Permissions</span>
                      </Button>
                      <Button variant="ghost" size="sm" title="Change role" onClick={() => { setRoleUser(u); setSelectedRole(u.role); }}>
                        <UserCheck className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Send password reset" onClick={() => handleResetPassword(u)}>
                        <Key className="w-4 h-4" />
                      </Button>
                      {u.user_id !== me?.id && (
                        <Button variant="ghost" size="sm" title={u.is_active ? 'Deactivate' : 'Reactivate'} onClick={() => handleToggleActive(u)}>
                          {u.is_active ? <Ban className="w-4 h-4 text-destructive" /> : <CircleCheck className="w-4 h-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!creating) setShowCreate(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>{createdCreds ? 'User created. Share these credentials securely.' : 'New Manager/Staff users get no module access until you tick it below.'}</DialogDescription>
          </DialogHeader>
          {createdCreds ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-1 text-sm">
                <p>Email: {createdCreds.email}</p>
                <p>Password: {createdCreds.password}</p>
              </div>
              <Button className="w-full" onClick={() => { navigator.clipboard.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`); toast.success('Credentials copied'); }}>Copy Credentials</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1"><Label htmlFor="c-name">Full Name *</Label><Input id="c-name" value={cName} maxLength={100} onChange={(e) => setCName(e.target.value)} disabled={creating} /></div>
              <div className="space-y-1"><Label htmlFor="c-email">Email Address *</Label><Input id="c-email" type="email" value={cEmail} maxLength={255} onChange={(e) => setCEmail(e.target.value)} disabled={creating} /></div>
              <div className="space-y-1">
                <Label htmlFor="c-pass">Password *</Label>
                <div className="flex gap-2">
                  <Input id="c-pass" type="text" value={cPass} onChange={(e) => setCPass(e.target.value)} disabled={creating} />
                  <Button type="button" variant="outline" disabled={creating} onClick={() => { const p = generatePassword(); setCPass(p); setCPass2(p); }}>Generate</Button>
                </div>
              </div>
              <div className="space-y-1"><Label htmlFor="c-pass2">Confirm Password *</Label><Input id="c-pass2" type="text" value={cPass2} onChange={(e) => setCPass2(e.target.value)} disabled={creating} /></div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={cRole} onValueChange={(v: Role) => setCRole(v)} disabled={creating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {cRole === 'admin' ? (
                <p className="text-sm p-3 rounded-md bg-muted">Admin has full application access.</p>
              ) : (
                <div className="space-y-1"><Label>Configure Permissions</Label><PermissionMatrix value={cPerms} onChange={setCPerms} disabled={creating} /></div>
              )}
            </div>
          )}
          <DialogFooter>
            {createdCreds ? (
              <Button onClick={() => setShowCreate(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create User'}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions */}
      <Dialog open={!!permUser} onOpenChange={(o) => { if (!o && !savingPerms) setPermUser(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions</DialogTitle>
            <DialogDescription>{permUser?.display_name || permUser?.email} · {permUser?.email}</DialogDescription>
          </DialogHeader>
          {permUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">Role: {roleBadge(permUser.role)}</div>
              {permUser.role === 'admin' ? (
                <p className="text-sm p-3 rounded-md bg-muted">Admin has full application access.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Current: {summarize(permsByUser[permUser.user_id] ?? emptyPerms())}</p>
                  <PermissionMatrix value={editPerms} onChange={setEditPerms} disabled={savingPerms} />
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermUser(null)} disabled={savingPerms}>Cancel</Button>
            {permUser?.role !== 'admin' && <Button onClick={savePerms} disabled={savingPerms}>{savingPerms ? 'Saving...' : 'Save Permissions'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role */}
      <Dialog open={!!roleUser} onOpenChange={(o) => { if (!o) setRoleUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>Update the role for {roleUser?.email}</DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={(v: Role) => setSelectedRole(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleUser(null)}>Cancel</Button>
            <Button onClick={handleChangeRole}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit */}
      <Dialog open={showAudit} onOpenChange={setShowAudit}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User & Permission History</DialogTitle>
            <DialogDescription>Latest 200 changes. Read-only.</DialogDescription>
          </DialogHeader>
          {audit.length === 0 ? <p className="text-sm text-muted-foreground">No history yet.</p> : (
            <div className="space-y-2">
              {audit.map((a) => (
                <div key={a.id} className="border rounded-md p-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{a.target_email ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{new Date(a.changed_at).toLocaleString()}</span>
                  </div>
                  <p>{describe(a)}</p>
                  <p className="text-xs text-muted-foreground">By {emailOf(a.changed_by)}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
