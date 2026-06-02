import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Users, Plus, Shield, Trash2, Mail, Crown, User, Eye, BarChart3,
  MessageCircle, DollarSign, Building2, Download, X, CheckSquare, Square,
  Clock, TrendingUp, AlertCircle, Trophy, Hourglass
} from 'lucide-react';

const PERMISSION_DEFS = [
  { key: 'view_all_leads',    label: 'View All Leads',    desc: 'See leads assigned to any agent',       icon: Users },
  { key: 'view_all_pipeline', label: 'View All Pipeline', desc: 'See all deals in the pipeline',         icon: BarChart3 },
  { key: 'view_all_whatsapp', label: 'View All WhatsApp', desc: 'Access all WhatsApp conversations',     icon: MessageCircle },
  { key: 'view_finance',      label: 'View Finance',      desc: 'Access invoices, commissions, revenue', icon: DollarSign },
  { key: 'view_analytics',    label: 'View Analytics',    desc: 'Access analytics dashboards',           icon: BarChart3 },
  { key: 'manage_team',       label: 'Manage Team',       desc: 'Invite members, assign roles',          icon: Users },
  { key: 'manage_landlords',  label: 'Manage Landlords',  desc: 'Full landlord CRM access',              icon: Building2 },
  { key: 'manage_properties', label: 'Manage Properties', desc: 'Create and edit property listings',     icon: Building2 },
  { key: 'export_data',       label: 'Export Data',       desc: 'Download reports and exports',          icon: Download },
];

const ROLE_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

const SYSTEM_ROLES = {
  admin:   { label: 'Admin',   color: '#F59E0B', icon: Crown },
  ceo:     { label: 'CEO',     color: '#DC2626', icon: Trophy },
  manager: { label: 'Manager', color: '#10B981', icon: Shield },
  agent:   { label: 'Agent',   color: '#3B82F6', icon: User },
  viewer:  { label: 'Viewer',  color: '#94A3B8', icon: Eye },
};

function RoleBadge({ role }) {
  const meta = SYSTEM_ROLES[role] || { label: role, color: '#94A3B8', icon: User };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
      <Icon className="w-3 h-3" />{meta.label}
    </span>
  );
}

function PermissionToggle({ permKey, value, onChange }) {
  const def = PERMISSION_DEFS.find(d => d.key === permKey);
  return (
    <button onClick={() => onChange(permKey, !value)}
      className="flex items-center gap-3 p-3 rounded-xl w-full text-left transition-all"
      style={{
        background: value ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
        border: value ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.08)',
      }}>
      {value ? <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" /> : <Square className="w-4 h-4 text-white/30 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: value ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)' }}>{def?.label}</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{def?.desc}</p>
      </div>
    </button>
  );
}

export default function Team() {
  const { user: currentUser, isAdmin } = useCurrentUser();
  const qc = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [inviting, setInviting] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleColor, setRoleColor] = useState(ROLE_COLORS[0]);
  const [rolePermissions, setRolePermissions] = useState({});

  const { data: users = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['pending-invites'],
    queryFn: () => base44.entities.TeamInvitation.filter({ status: 'pending' }, '-sent_at', 100),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list('name', 100),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agent_workload'],
    queryFn: () => base44.entities.AgentWorkload.list('-total_conversations', 100),
    refetchInterval: 30000,
  });

  const createRoleMutation = useMutation({
    mutationFn: (data) => editingRole
      ? base44.entities.Role.update(editingRole.id, data)
      : base44.entities.Role.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); resetRoleForm(); toast.success(editingRole ? 'Role updated' : 'Role created'); },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => base44.entities.Role.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role deleted'); },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role, customRoleId }) =>
      base44.entities.User.update(userId, { role, custom_role_id: customRoleId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-users'] }); toast.success('Role updated'); },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-users'] }); qc.invalidateQueries({ queryKey: ['pending-invites'] }); toast.success('Account deleted'); },
  });

  const disableUserMutation = useMutation({
    mutationFn: ({ userId, currentRole }) =>
      base44.entities.User.update(userId, { role: currentRole === 'disabled' ? 'user' : 'disabled' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-users'] }); qc.invalidateQueries({ queryKey: ['pending-invites'] }); toast.success('Account disabled'); },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole === 'admin' ? 'admin' : 'user');
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (e) {
      toast.error(e.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const resetRoleForm = () => {
    setShowRoleForm(false); setEditingRole(null);
    setRoleName(''); setRoleDesc(''); setRoleColor(ROLE_COLORS[0]); setRolePermissions({});
  };

  const openEditRole = (role) => {
    setEditingRole(role); setRoleName(role.name); setRoleDesc(role.description || '');
    setRoleColor(role.color || ROLE_COLORS[0]); setRolePermissions(role.permissions || {});
    setShowRoleForm(true);
  };

  const handleSaveRole = () => {
    if (!roleName.trim()) return;
    createRoleMutation.mutate({ name: roleName.trim(), description: roleDesc.trim(), color: roleColor, permissions: rolePermissions });
  };

  return (
    <div className="page-root">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="page-title text-3xl">Team</h1>
          <p className="page-subtitle mt-1">Members, roles, permissions, and performance</p>
        </div>

        {/* Always-visible Quick Invite Banner */}
        {isAdmin && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'hsl(38 92% 55%)' }}>
              <Mail className="w-5 h-5" /> Invite Team Member
            </h2>
            <div className="flex gap-3 flex-wrap">
              <Input placeholder="Email address e.g. ahmad@erudite-estate.com" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                className="flex-1 min-w-52 glass-input text-base" style={{ minHeight: 44 }} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', minHeight: 44 }}>
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
                <option value="ceo">CEO</option>
              </select>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                className="gap-2 font-bold text-base px-6" style={{ background: 'hsl(38 92% 50%)', color: '#000', minHeight: 44 }}>
                <Plus className="w-5 h-5" />
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
              <Button onClick={async () => {
                  if (!inviteEmail.trim()) {
                    toast.error('Please enter an email address');
                    return;
                  }
                  try {
                    console.log('Sending password reset to:', inviteEmail.trim());
                    await base44.users.inviteUser(inviteEmail.trim(), 'user');
                    console.log('Password reset sent successfully');
                    toast.success(`Password reset link sent to ${inviteEmail}`);
                  } catch(e) {
                    console.error('Password reset failed:', e);
                    toast.error(e.message || 'Failed to send reset link');
                  }
                }}
                disabled={inviting || !inviteEmail.trim()}
                className="gap-2 font-bold text-base px-6" style={{ background: '#6366f1', color: '#fff', minHeight: 44 }}>
                🔑 Reset Password
              </Button>
            </div>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>The person receives an email with a link to set their password and log in.</p>
          </div>
        )}

        <Tabs defaultValue={isAdmin ? 'members' : 'performance'}>
          <TabsList className="glass-card">
            {isAdmin && (
              <TabsTrigger value="members" className="gap-2">
                <Users className="w-4 h-4" /> Members ({users.length})
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="pending" className="gap-2">
                <Hourglass className="w-4 h-4" /> Pending ({pendingInvites.length})
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="roles" className="gap-2">
                <Shield className="w-4 h-4" /> Roles
              </TabsTrigger>
            )}
            <TabsTrigger value="performance" className="gap-2">
              <Trophy className="w-4 h-4" /> Performance
            </TabsTrigger>
          </TabsList>

          {/* Pending Invitations Tab */}
          {isAdmin && (
            <TabsContent value="pending" className="mt-4 space-y-4">
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Hourglass className="w-4 h-4 text-amber-500" />
                      Pending Invitations ({pendingInvites.length})
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Team members who haven't activated their account yet
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {pendingInvites.map(invite => {
                    const sentDate = invite.sent_at ? new Date(invite.sent_at) : new Date();
                    const daysAgo = Math.floor((new Date() - sentDate) / (1000 * 60 * 60 * 24));
                    const roleName = invite.custom_role_name || (invite.base_role === 'admin' ? 'Admin' : 'Agent');
                    return (
                      <div key={invite.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-amber-500 shrink-0"
                          style={{ background: 'hsl(38 92% 50% / 0.18)' }}>
                          {invite.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{invite.email}</p>
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                              <Hourglass className="w-2.5 h-2.5 mr-0.5" /> Pending
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Role: {roleName} • Invited by: {invite.invited_by_email || 'Admin'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Invited {daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <RoleBadge role={invite.base_role === 'admin' ? 'admin' : 'agent'} />
                          <Button size="sm" variant="outline"
                            onClick={async () => {
                              try {
                                console.log('Resending invite to:', invite.email);
                                await base44.users.inviteUser(invite.email, invite.base_role);
                                console.log('Invite resent successfully');
                                toast.success(`Invite resent to ${invite.email}`);
                              } catch(e) {
                                console.error('Resend failed:', e);
                                toast.error(e.message || 'Failed to resend invite');
                              }
                            }}
                            className="h-7 text-xs gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                            <Mail className="w-3 h-3" /> Resend
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={async () => {
                              try {
                                await base44.entities.TeamInvitation.update(invite.id, { status: 'cancelled' });
                                toast.success('Invitation cancelled');
                              } catch(e) {
                                toast.error(e.message || 'Failed to cancel');
                              }
                            }}
                            className="h-7 text-xs gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10">
                            <X className="w-3 h-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {pendingInvites.length === 0 && (
                    <div className="text-center py-14 text-muted-foreground text-sm">
                      <Hourglass className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No pending invitations
                      <p className="text-xs mt-1 opacity-60">All team members have activated their accounts</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {/* Members Tab */}
          {isAdmin && (
            <TabsContent value="members" className="mt-4 space-y-4">
              <div className="glass-card rounded-2xl p-5">
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent" /> Invite Team Member
                </h2>
                <div className="flex gap-3 flex-wrap">
                  <Input placeholder="Email address" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    className="flex-1 min-w-52 glass-input" />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="glass-input rounded-md px-3 py-2 text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}>
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                    <Plus className="w-4 h-4" />
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Member receives an email invitation to join the CRM.</p>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10">
                  <p className="text-sm font-semibold">{users.length} Members</p>
                </div>
                <div className="divide-y divide-white/5">
                  {users.map(u => (
                    <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-accent shrink-0"
                        style={{ background: 'hsl(38 92% 50% / 0.18)' }}>
                        {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{u.full_name || '(No name)'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <RoleBadge role={u.role} />
                        {u.id !== currentUser?.id ? (
                          <>
                            <Button size="sm" variant="outline"
                              onClick={async () => {
                                try {
                                  console.log('Resending invite to:', u.email, 'role:', u.role);
                                  await base44.users.inviteUser(u.email, u.role === 'admin' ? 'admin' : 'user');
                                  console.log('Invite resent successfully to:', u.email);
                                  toast.success(`Invite resent to ${u.email}`);
                                } catch(e) {
                                  console.error('Resend invite failed:', e);
                                  toast.error(e.message || 'Failed to resend invite');
                                }
                              }}
                              className="h-7 text-xs gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                              <Mail className="w-3 h-3" /> Resend Invite
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={async () => {
                                try {
                                  console.log('Sending password reset to:', u.email);
                                  await base44.users.inviteUser(u.email, u.role === 'admin' ? 'admin' : 'user');
                                  console.log('Password reset sent successfully to:', u.email);
                                  toast.success(`Password reset link sent to ${u.email}`);
                                } catch(e) {
                                  console.error('Password reset failed:', e);
                                  toast.error(e.message || 'Failed to send reset link');
                                }
                              }}
                              className="h-7 text-xs gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10">
                              🔑 Reset Password
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => {
                                if (confirm(`Disable account for ${u.email}?`)) {
                                  disableUserMutation.mutate({ userId: u.id, currentRole: u.role });
                                }
                              }}
                              className="h-7 text-xs gap-1 border-orange-500/40 text-orange-400 hover:bg-orange-500/10">
                              {u.role === 'disabled' ? 'Enable' : 'Disable'}
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => {
                                if (confirm(`Delete account for ${u.email}? This cannot be undone.`)) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                              className="h-7 text-xs gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10">
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                            <select value={u.role || 'agent'}
                              onChange={e => updateUserRoleMutation.mutate({ userId: u.id, role: e.target.value, customRoleId: u.custom_role_id })}
                              className="text-xs rounded-lg px-2 py-1.5"
                              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                              <option value="admin">Admin</option>
                              <option value="ceo">CEO</option>
                              <option value="manager">Manager</option>
                              <option value="agent">Agent</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-14 text-muted-foreground text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No members yet. Send an invite above.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {/* Roles Tab */}
          {isAdmin && (
            <TabsContent value="roles" className="mt-4 space-y-4">
              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-semibold">Built-in Roles</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(SYSTEM_ROLES).map(([key, meta]) => {
                    const Icon = meta.icon;
                    return (
                      <div key={key} className="flex items-center gap-2 p-2.5 rounded-xl"
                        style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}25` }}>
                        <Icon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
                        <div>
                          <p className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {key === 'admin' ? 'Full access' : key === 'manager' ? 'Team + analytics' : key === 'agent' ? 'Own data only' : 'Read-only'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                  <p className="text-sm font-semibold">Custom Roles</p>
                  <Button size="sm" onClick={() => { resetRoleForm(); setShowRoleForm(true); }}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1 h-8 text-xs">
                    <Plus className="w-3.5 h-3.5" /> New Role
                  </Button>
                </div>

                {showRoleForm && (
                  <div className="p-5 border-b border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{editingRole ? 'Edit Role' : 'Create Role'}</p>
                      <button onClick={resetRoleForm}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Role Name</label>
                        <Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g. Senior Agent" className="glass-input" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                        <Input value={roleDesc} onChange={e => setRoleDesc(e.target.value)} placeholder="Brief description" className="glass-input" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Color</label>
                      <div className="flex gap-2">
                        {ROLE_COLORS.map(c => (
                          <button key={c} onClick={() => setRoleColor(c)}
                            className="w-7 h-7 rounded-full transition-all"
                            style={{ background: c, outline: roleColor === c ? '2px solid white' : 'none', outlineOffset: '2px' }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Permissions</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {PERMISSION_DEFS.map(def => (
                          <PermissionToggle key={def.key} permKey={def.key}
                            value={!!rolePermissions[def.key]}
                            onChange={(k, v) => setRolePermissions(p => ({ ...p, [k]: v }))} />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveRole} disabled={!roleName.trim() || createRoleMutation.isPending}
                        className="bg-accent text-accent-foreground hover:bg-accent/90">
                        {createRoleMutation.isPending ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
                      </Button>
                      <Button variant="outline" onClick={resetRoleForm}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-white/5">
                  {roles.map(role => (
                    <div key={role.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: role.color || '#94A3B8' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{role.name}</p>
                        {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {PERMISSION_DEFS.filter(d => role.permissions?.[d.key]).map(d => (
                            <span key={d.key} className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
                              {d.label}
                            </span>
                          ))}
                          {!PERMISSION_DEFS.some(d => role.permissions?.[d.key]) && (
                            <span className="text-[10px] text-muted-foreground">No permissions</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openEditRole(role)} className="h-7 text-xs">Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRoleMutation.mutate(role.id)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {roles.length === 0 && !showRoleForm && (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No custom roles yet. Create one above.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                  <Users className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{agents.length}</div>
                  <p className="text-xs text-muted-foreground">{agents.filter(a => a.status === 'available').length} available</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {agents.length > 0 ? (agents.reduce((s, a) => s + (a.avg_response_time_minutes || 0), 0) / agents.length).toFixed(1) : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">minutes</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">SLA Breaches</CardTitle>
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{agents.reduce((s, a) => s + (a.sla_breaches || 0), 0)}</div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10">
                <p className="text-sm font-semibold">Agent Performance</p>
              </div>
              <div className="divide-y divide-white/5">
                {agents.map(agent => {
                  const isOverloaded = (agent.assigned_conversations || 0) >= 5;
                  return (
                    <div key={agent.id} className="p-4 hover:bg-white/3 transition-colors space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-accent"
                            style={{ background: 'hsl(38 92% 50% / 0.18)' }}>
                            {agent.agent_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{agent.agent_name}</p>
                            <p className="text-xs text-muted-foreground">{agent.agent_email}</p>
                          </div>
                        </div>
                        <Badge variant={isOverloaded ? 'destructive' : 'outline'}>
                          {agent.assigned_conversations || 0} active
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Response</p>
                          <p className="font-semibold">{agent.avg_response_time_minutes || 0}m</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Conversion</p>
                          <p className="font-semibold">{(agent.conversion_rate || 0).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Closed</p>
                          <p className="font-semibold">{agent.closed_deals || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="font-semibold">{(agent.total_revenue_aed || 0).toLocaleString()} AED</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {agents.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No agent performance data yet.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}