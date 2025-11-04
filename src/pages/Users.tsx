import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Mail, Key, UserX, UserCheck, LogOut, Package, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingStates';
import { OfflineIndicator } from '@/components/OfflineIndicator';

interface UserProfile {
  user_id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'manager' | 'staff';
  created_at: string;
}

export default function Users() {
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Form state for create user
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'staff'>('manager');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Form state for change role
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'staff'>('manager');

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAdmin, navigate]);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error('Email and password are required');
      return;
    }

    setCreatingUser(true);

    try {
      // Create user using Supabase Admin API via edge function
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          user_metadata: {
            display_name: newUserDisplayName || newUserEmail.split('@')[0],
            role: newUserRole,
          },
        },
      });

      if (error) throw error;

      toast.success('User created successfully!');
      setGeneratedPassword(newUserPassword);
      
      // Refresh users list
      await fetchUsers();
      
      // Reset form but keep dialog open to show password
    } catch (err) {
      console.error('Error creating user:', err);
      toast.error('Failed to create user. You may need to create an edge function for admin operations.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: selectedRole })
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      toast.success('Role updated successfully');
      setShowRoleDialog(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error('Failed to update role');
    }
  };

  const handleResetPassword = async (user: UserProfile) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      toast.success(`Password reset email sent to ${user.email}`);
    } catch (err) {
      console.error('Error sending reset email:', err);
      toast.error('Failed to send reset email');
    }
  };

  const openCreateDialog = () => {
    setNewUserEmail('');
    setNewUserDisplayName('');
    setNewUserRole('manager');
    setNewUserPassword(generatePassword());
    setGeneratedPassword(null);
    setShowCreateDialog(true);
  };

  const closeCreateDialog = () => {
    setShowCreateDialog(false);
    setGeneratedPassword(null);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">User Management</h1>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Actions Bar */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Users</h2>
              <p className="text-muted-foreground">Manage user accounts and roles</p>
            </div>
            <Button onClick={openCreateDialog}>
              <UserPlus className="w-4 h-4 mr-2" />
              Create User
            </Button>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-card">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="border rounded-lg bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.display_name || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === 'admin'
                              ? 'destructive'
                              : user.role === 'manager'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedRole(user.role);
                            setShowRoleDialog(true);
                          }}
                        >
                          <UserCheck className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPassword(user)}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={closeCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              {generatedPassword
                ? 'User created! Share these credentials securely.'
                : 'Add a new user to the system. A password will be generated.'}
            </DialogDescription>
          </DialogHeader>

          {generatedPassword ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Email: {newUserEmail}</p>
                <p className="text-sm font-medium">Password: {generatedPassword}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Make sure to copy this password - it won't be shown again!
                </p>
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Email: ${newUserEmail}\nPassword: ${generatedPassword}`
                  );
                  toast.success('Credentials copied to clipboard');
                }}
                className="w-full"
              >
                Copy Credentials
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@company.com"
                  disabled={creatingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={newUserDisplayName}
                  onChange={(e) => setNewUserDisplayName(e.target.value)}
                  placeholder="John Doe"
                  disabled={creatingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUserRole}
                  onValueChange={(value: 'admin' | 'manager' | 'staff') =>
                    setNewUserRole(value)
                  }
                  disabled={creatingUser}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    disabled={creatingUser}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNewUserPassword(generatePassword())}
                    disabled={creatingUser}
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {generatedPassword ? (
              <Button onClick={closeCreateDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={creatingUser}>
                  {creatingUser ? 'Creating...' : 'Create User'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roleSelect">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: 'admin' | 'manager' | 'staff') =>
                  setSelectedRole(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
