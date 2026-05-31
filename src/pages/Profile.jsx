import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { User, Mail, Phone, Save, Shield } from 'lucide-react';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '' });

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({ full_name: u?.full_name || '', phone: u?.phone || '' });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: form.full_name, phone: form.phone });
      toast.success('Profile updated successfully');
      setUser(prev => ({ ...prev, ...form }));
    } catch (e) {
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-root flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const roleLabel = { admin: 'Admin', manager: 'Manager', agent: 'Agent', viewer: 'Viewer' }[user?.role] || user?.role || 'Member';
  const roleColor = { admin: '#F59E0B', manager: '#10B981', agent: '#3B82F6', viewer: '#94A3B8' }[user?.role] || '#94A3B8';

  return (
    <div className="page-root">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="page-title text-3xl">My Profile</h1>
          <p className="page-subtitle mt-1">Edit your personal information</p>
        </div>

        {/* Avatar + role */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-accent"
                style={{ background: 'hsl(38 92% 50% / 0.18)' }}>
                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-lg font-semibold">{user?.full_name || '(No name)'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: `${roleColor}20`, color: roleColor, border: `1px solid ${roleColor}40` }}>
                  <Shield className="w-3 h-3" />
                  {roleLabel}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-accent" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="glass-input pl-9"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={user?.email || ''} disabled className="glass-input pl-9 opacity-50 cursor-not-allowed" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+971 50 000 0000"
                  className="glass-input pl-9"
                />
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Shield className="w-3 h-3 inline mr-1 text-amber-500" />
                Your role ({roleLabel}) is assigned by your admin and cannot be changed here.
              </p>
              <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}