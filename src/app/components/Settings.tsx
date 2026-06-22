import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllUserPermissions, updateUserPermission, supabase } from '../../lib/supabase';
import { UserPlus, ShieldAlert, Key, Mail, Trash2, Check, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface UserPermission {
  email: string;
  role: 'admin' | 'viewer';
}

export function Settings() {
  const { isAdmin, user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(false);

  const loadPermissions = async () => {
    try {
      const data = await getAllUserPermissions();
      setPermissions(data);
    } catch {
      toast.error('Failed to load user permissions.');
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadPermissions();
    }
  }, [isAdmin]);

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    if (permissions.some(p => p.email === cleanEmail)) {
      toast.error('Permission for this email already exists.');
      return;
    }

    setLoading(true);
    try {
      await updateUserPermission(cleanEmail, role);
      toast.success(`Permission configured for ${cleanEmail}!`);
      setEmail('');
      setRole('viewer');
      await loadPermissions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to configure permission.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (targetEmail: string, currentRole: 'admin' | 'viewer') => {
    if (targetEmail.toLowerCase() === user?.email?.toLowerCase()) {
      toast.error('You cannot change your own permission.');
      return;
    }

    const nextRole = currentRole === 'admin' ? 'viewer' : 'admin';
    try {
      await updateUserPermission(targetEmail, nextRole);
      toast.success(`Updated ${targetEmail} to ${nextRole === 'admin' ? 'Can Edit' : 'View Only'}`);
      await loadPermissions();
    } catch {
      toast.error('Failed to update permission.');
    }
  };

  const handleDeletePermission = async (targetEmail: string) => {
    if (targetEmail.toLowerCase() === user?.email?.toLowerCase()) {
      toast.error('You cannot delete your own permission.');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('email', targetEmail);
      
      if (error) throw error;
      toast.success(`Removed permission record for ${targetEmail}`);
      await loadPermissions();
    } catch {
      toast.error('Failed to remove permission.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="size-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto shadow-inner">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-sm text-slate-450 leading-relaxed">
            You do not have permission to view this page. Please contact your system administrator to request "Can Edit" access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          User Permissions Settings
        </h2>
        <p className="text-slate-450 text-sm mt-0.5">
          Configure access control. View-only users cannot edit dashboard elements, scores, parameters, or delete agents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Side: Configure Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <UserPlus className="size-4 text-indigo-500" />
            Configure New Permission
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Assign standard permissions by email. When a user logs in with this email, they will automatically receive this access level.
          </p>
          
          <form onSubmit={handleAddPermission} className="space-y-4 pt-2">
            <div>
              <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">
                User Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@company.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">
                Access Level
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white text-slate-700 font-semibold"
              >
                <option value="viewer">View Only (Viewer)</option>
                <option value="admin">Can Edit (Admin / Editor)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="size-4" />
                  <span>Configure Permission</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Permissions Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-2 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
            <Shield className="size-4 text-indigo-500" />
            Manage Permissions List
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">User Email</th>
                  <th className="py-3 px-4 text-xs font-black uppercase text-slate-400 tracking-wider">Role</th>
                  <th className="py-3 px-4 text-xs font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => {
                  const isSelf = p.email.toLowerCase() === user?.email?.toLowerCase();
                  return (
                    <tr key={p.email} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-750">
                        <div className="flex items-center gap-2">
                          <span>{p.email}</span>
                          {isSelf && (
                            <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          disabled={isSelf}
                          onClick={() => handleToggleRole(p.email, p.role)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                            p.role === 'admin'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70'
                              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/50'
                          } disabled:opacity-75 disabled:pointer-events-none`}
                        >
                          {p.role === 'admin' ? 'Can Edit (Admin)' : 'View Only (Viewer)'}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          disabled={isSelf}
                          onClick={() => handleDeletePermission(p.email)}
                          className="size-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center ml-auto transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                          title={isSelf ? 'Cannot delete yourself' : 'Remove permission'}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {permissions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                      No permissions configured. First registered user defaults to Admin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
