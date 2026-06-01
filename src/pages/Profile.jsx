import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { User, Mail, Phone, Save, Shield, Upload, Camera } from 'lucide-react';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', position: '', profile_image: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({ full_name: u?.full_name || '', phone: u?.phone || '', position: u?.position || '', profile_image: u?.profile_image || '' });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, profile_image: file_url }));
      toast.success('Profile picture uploaded');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: form.full_name, phone: form.phone, position: form.position, profile_image: form.profile_image });
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

        {/* Profile Picture + Role */}
        <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.05) 100%)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="p-8">
            <div className="flex items-end gap-6">
              <div className="relative group">
                <div className="w-28 h-28 rounded-2xl flex items-center justify-center text-4xl font-bold text-accent overflow-hidden border-2 border-accent/30"
                  style={{ background: form.profile_image ? 'transparent' : 'hsl(38 92% 50% / 0.18)' }}>
                  {form.profile_image ? (
                    <img src={form.profile_image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  style={{ background: 'hsl(38 92% 50%)', color: '#000' }}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold">{user?.full_name || '(No name)'}</p>
                <p className="text-accent font-semibold text-sm mt-1">{form.position || 'Position not set'}</p>
                <p className="text-xs text-muted-foreground mt-3">{user?.email}</p>
                <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${roleColor}20`, color: roleColor, border: `1px solid ${roleColor}40` }}>
                  <Shield className="w-3 h-3" />
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

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

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Position / Title</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="e.g. CEO of Erudite Real Estate"
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