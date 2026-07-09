import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { User, Mail, Phone, Save, Shield, Upload, Camera, Trash2, AlertTriangle, FileSignature, Bell, Plus, Clock } from 'lucide-react';
import GoogleWorkspaceConnectBanner from '@/components/settings/GoogleWorkspaceConnectBanner';
import ReactQuill from 'react-quill';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ display_name: '', phone: '', position: '', profile_image: '', signature_url: '', signature_card_url: '', email_signature_html: '', default_reminder_text: '', default_reminders: [], office_location: '', pf_profile_url: '', pf_rating: '', pf_deals_count: '', pf_deals_value_label: '', erudite_listings_url: '', meet_team_url: '', signature_stat_label: '', whatsapp_number: '', whatsapp_instance: '' });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const signatureCardInputRef = useRef(null);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [waConfiguring, setWaConfiguring] = useState(false);
  const [waQr, setWaQr] = useState(null);
  const [waInstance, setWaInstance] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({ display_name: u?.display_name || u?.full_name || '', phone: u?.phone || '', position: u?.position || '', profile_image: u?.profile_image || '', signature_url: u?.signature_url || '', signature_card_url: u?.signature_card_url || '', email_signature_html: u?.email_signature_html || '', default_reminder_text: u?.default_reminder_text || '', default_reminders: u?.default_reminders || [], office_location: u?.office_location || '', pf_profile_url: u?.pf_profile_url || '', pf_rating: u?.pf_rating || '', pf_deals_count: u?.pf_deals_count || '', pf_deals_value_label: u?.pf_deals_value_label || '', erudite_listings_url: u?.erudite_listings_url || '', meet_team_url: u?.meet_team_url || '', signature_stat_label: u?.signature_stat_label || '', whatsapp_number: u?.whatsapp_number || '', whatsapp_instance: u?.whatsapp_instance || '' });
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

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSig(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, signature_url: file_url }));
      toast.success('Signature uploaded');
    } catch (err) {
      toast.error('Failed to upload signature');
    } finally {
      setUploadingSig(false);
    }
  };

  const handleSignatureCardUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCard(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, signature_card_url: file_url }));
      toast.success('Signature card uploaded');
    } catch (err) {
      toast.error('Failed to upload signature card');
    } finally {
      setUploadingCard(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ display_name: form.display_name, phone: form.phone, position: form.position, profile_image: form.profile_image, signature_url: form.signature_url, signature_card_url: form.signature_card_url, email_signature_html: form.email_signature_html, default_reminder_text: form.default_reminder_text, default_reminders: form.default_reminders, office_location: form.office_location, pf_profile_url: form.pf_profile_url, pf_rating: form.pf_rating ? Number(form.pf_rating) : null, pf_deals_count: form.pf_deals_count ? Number(form.pf_deals_count) : null, pf_deals_value_label: form.pf_deals_value_label, erudite_listings_url: form.erudite_listings_url, meet_team_url: form.meet_team_url, signature_stat_label: form.signature_stat_label, whatsapp_number: form.whatsapp_number, whatsapp_instance: form.whatsapp_instance });
      toast.success('Profile updated successfully');
      setUser(prev => ({ ...prev, ...form }));
    } catch (e) {
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigureWhatsApp = async () => {
    const num = (form.whatsapp_number || '').trim();
    if (!num) { toast.error('Enter your WhatsApp number first'); return; }
    setWaConfiguring(true);
    setWaQr(null);
    try {
      const res = await base44.functions.invoke('setupAgentWhatsApp', { whatsapp_number: num });
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Configuration failed');
      setWaInstance(data.instance || '');
      setWaQr(data.qr_base64 || null);
      setForm(f => ({ ...f, whatsapp_number: data.whatsapp_number || num, whatsapp_instance: data.instance || '' }));
      setUser(prev => ({ ...prev, whatsapp_number: data.whatsapp_number || num, whatsapp_instance: data.instance }));
      toast.success('Scan the QR with your WhatsApp to link your line');
    } catch (e) {
      toast.error(e?.message || 'Failed to configure WhatsApp line');
    } finally {
      setWaConfiguring(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Note: Base44 doesn't support user deletion via API, so we show a message
      toast.error('Account deletion requires admin assistance. Please contact support.');
    } catch (e) {
      toast.error(e.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
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
                    (form.display_name || user?.full_name || user?.email)?.[0]?.toUpperCase() || '?'
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
                <p className="text-2xl font-bold">{form.display_name || user?.full_name || '(No name)'}</p>
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
                  value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
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

        {/* Your WhatsApp line */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent" /> Your WhatsApp Line
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Enter your own WhatsApp number. Messages send from your number, not the shared company line.
              Configure once and scan the QR with WhatsApp to link it.
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Your WhatsApp Number</label>
              <div className="flex gap-2">
                <Input
                  value={form.whatsapp_number}
                  onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                  placeholder="+971 50 000 0000"
                  className="glass-input"
                />
                <Button onClick={handleConfigureWhatsApp} disabled={waConfiguring} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 whitespace-nowrap">
                  {waConfiguring ? 'Configuring…' : 'Configure'}
                </Button>
              </div>
            </div>
            {form.whatsapp_instance && (
              <p className="text-xs text-emerald-400">
                ✓ Line configured ({form.whatsapp_instance}){waQr ? ' — scan the QR below to link your phone' : ' — linked'}
              </p>
            )}
            {waQr && (
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src={waQr.startsWith('data:') ? waQr : `data:image/png;base64,${waQr}`} alt="WhatsApp QR" className="w-48 h-48 rounded-lg" />
                <p className="text-xs text-muted-foreground text-center">Open WhatsApp → Settings → Linked Devices → Link a Device → scan this code</p>
              </div>
            )}
            {!form.whatsapp_instance && (
              <p className="text-xs text-amber-400">
                ⚠ No WhatsApp line configured — your WhatsApp send button is disabled until you set this up.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Signature Upload */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-accent" /> Email Signature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Your signature image appears at the bottom of the compose window and is sent with every email. The branded call-to-action grid below is appended automatically on send.
            </p>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-48 h-20 rounded-xl flex items-center justify-center border-2 border-dashed border-accent/30 overflow-hidden"
                  style={{ background: form.signature_url ? 'transparent' : 'hsl(38 92% 50% / 0.08)' }}>
                  {form.signature_url ? (
                    <img src={form.signature_url} alt="Signature" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No signature</span>
                  )}
                </div>
                <button
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={uploadingSig}
                  className="absolute bottom-1 right-1 p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  style={{ background: 'hsl(38 92% 50%)', color: '#000' }}
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  disabled={uploadingSig}
                  className="hidden"
                />
              </div>
              {form.signature_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm(f => ({ ...f, signature_url: '' }))}
                  className="text-red-400 hover:bg-red-500/10 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </Button>
              )}
            </div>

            {/* HTML Rich-Text Signature */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">HTML Signature (auto-appended to every email)</label>
              <div className="ec-quill-sig" style={{ borderRadius: 8, overflow: 'hidden' }}>
                <style>{`
                  .ec-quill-sig .ql-toolbar.ql-snow { border:1px solid rgba(255,255,255,0.12) !important; border-bottom:none !important; background:rgba(255,255,255,0.03); border-radius:8px 8px 0 0; }
                  .ec-quill-sig .ql-container.ql-snow { border:1px solid rgba(255,255,255,0.12) !important; border-radius:0 0 8px 8px; background:rgba(255,255,255,0.04); min-height:80px; font-family:'Inter',sans-serif; }
                  .ec-quill-sig .ql-editor { color:rgba(255,255,255,0.9); font-size:13px; }
                  .ec-quill-sig .ql-editor.ql-blank::before { color:rgba(255,255,255,0.35); font-style:normal; }
                  .ec-quill-sig .ql-snow .ql-stroke { stroke:rgba(255,255,255,0.6) !important; }
                  .ec-quill-sig .ql-snow .ql-fill { fill:rgba(255,255,255,0.6) !important; }
                  .ec-quill-sig .ql-snow .ql-tooltip { background:#1a2235 !important; border:1px solid rgba(255,255,255,0.15) !important; color:rgba(255,255,255,0.9) !important; }
                  .ec-quill-sig .ql-snow .ql-tooltip input[type=text] { background:rgba(255,255,255,0.06) !important; border:1px solid rgba(255,255,255,0.12) !important; color:rgba(255,255,255,0.9) !important; border-radius:4px; }
                `}</style>
                <ReactQuill
                  theme="snow"
                  value={form.email_signature_html}
                  onChange={(v) => setForm(f => ({ ...f, email_signature_html: v }))}
                  modules={{ toolbar: [['bold', 'italic', 'underline'], ['link'], ['clean']] }}
                  placeholder="Best regards, Your Name — Erudite Real Estate"
                />
              </div>
            </div>

            {/* Branded call-to-action grid — appended to every email you send (built from the details below) */}
            <div className="pt-3 mt-3 border-t border-white/10">
              <label className="text-xs text-accent font-semibold mb-1 block">Branded Call-to-Action Grid (appended to every email you send)</label>
              <p className="text-[11px] text-muted-foreground mb-3">
                This grid of links (Property Finder, Erudite Listings, Meet the Team, Instagram) is built from your details below and appended below your signature image on every sent email.
              </p>

              {/* CTA grid configuration */}
              <label className="text-[11px] text-muted-foreground mb-2 block">Call-to-action grid details</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Property Finder Profile URL</label>
                  <Input value={form.pf_profile_url} onChange={e => setForm(f => ({ ...f, pf_profile_url: e.target.value }))} placeholder="https://www.propertyfinder.ae/en/agent/..." className="glass-input" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Erudite Listings URL</label>
                  <Input value={form.erudite_listings_url} onChange={e => setForm(f => ({ ...f, erudite_listings_url: e.target.value }))} placeholder="https://www.eruditeproperty.com" className="glass-input" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Meet the Team URL</label>
                  <Input value={form.meet_team_url} onChange={e => setForm(f => ({ ...f, meet_team_url: e.target.value }))} placeholder="https://www.eruditeproperty.com" className="glass-input" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">PF Rating (★)</label>
                  <Input type="number" step="0.1" value={form.pf_rating} onChange={e => setForm(f => ({ ...f, pf_rating: e.target.value }))} placeholder="4.3" className="glass-input" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">PF Deals Count</label>
                  <Input type="number" value={form.pf_deals_count} onChange={e => setForm(f => ({ ...f, pf_deals_count: e.target.value }))} placeholder="56" className="glass-input" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">PF Deals Value Label</label>
                  <Input value={form.pf_deals_value_label} onChange={e => setForm(f => ({ ...f, pf_deals_value_label: e.target.value }))} placeholder="AED 100M+" className="glass-input" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Trophy Stat Line</label>
                  <Input value={form.signature_stat_label} onChange={e => setForm(f => ({ ...f, signature_stat_label: e.target.value }))} placeholder="AED 100M+ closed in Peninsula" className="glass-input" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My Reminder Defaults */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" /> My Reminder Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              These pre-fill the booking dialog when you schedule an appointment. You can still edit them per booking.
            </p>

            {/* Default reminder text */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Default reminder message</label>
              <Textarea
                value={form.default_reminder_text}
                onChange={(e) => setForm(f => ({ ...f, default_reminder_text: e.target.value }))}
                placeholder="Hi {{landlord_name}}, this is a reminder about our meeting: {{title}}. See you soon! — {{agent_name}}"
                className="glass-input min-h-[60px] text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use <code className="text-accent">{'{{landlord_name}}'}</code>, <code className="text-accent">{'{{title}}'}</code>, <code className="text-accent">{'{{agent_name}}'}</code> as placeholders.
              </p>
            </div>

            {/* Default reminder set */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Default reminders</label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm(f => ({ ...f, default_reminders: [...(f.default_reminders || []), { when_hours: 24, text: f.default_reminder_text || '' }] }))}
                  className="text-accent hover:bg-accent/10 gap-1.5 h-7 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add reminder
                </Button>
              </div>
              {(form.default_reminders || []).length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  No default reminders yet.
                </p>
              )}
              {(form.default_reminders || []).map((r, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 p-2.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-400 flex-none" />
                    <select
                      value={r.when_hours}
                      onChange={(e) => setForm(f => ({ ...f, default_reminders: f.default_reminders.map((rr, i) => i === idx ? { ...rr, when_hours: Number(e.target.value) } : rr) }))}
                      className="glass-input px-2 py-1.5 text-xs rounded-md flex-1"
                    >
                      <option value={1}>1 hour before</option>
                      <option value={3}>3 hours before</option>
                      <option value={6}>6 hours before</option>
                      <option value={24}>1 day before</option>
                      <option value={48}>2 days before</option>
                      <option value={72}>3 days before</option>
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setForm(f => ({ ...f, default_reminders: f.default_reminders.filter((_, i) => i !== idx) }))}
                      className="text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={r.text}
                    onChange={(e) => setForm(f => ({ ...f, default_reminders: f.default_reminders.map((rr, i) => i === idx ? { ...rr, text: e.target.value } : rr) }))}
                    placeholder="Reminder message…"
                    className="glass-input min-h-[36px] text-xs"
                  />
                </div>
              ))}
            </div>

            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Defaults'}
            </Button>
          </CardContent>
        </Card>

        {/* Google Workspace Connection */}
        <GoogleWorkspaceConnectBanner />

        {/* Danger Zone */}
        <Card className="glass-card border-red-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Account deletion is permanent and cannot be undone. This action requires admin assistance.
            </p>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Account?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action requires admin assistance. Your account and all associated data will be permanently removed.
              Please contact Base44 support for account deletion requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.info('Please contact support@base44.com for account deletion');
                setShowDeleteDialog(false);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Contact Support
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}