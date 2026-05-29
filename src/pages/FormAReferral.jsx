import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, FileSignature, Check, Clock, Send, ChevronRight, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-muted text-muted-foreground' },
  sent:      { label: 'Sent',      color: 'bg-blue-500/10 text-blue-400' },
  accepted:  { label: 'Accepted',  color: 'bg-accent/10 text-accent' },
  completed: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-400' },
};

const EMPTY_FORM = {
  status: 'draft',
  referring_agent_name: '', referring_agent_email: '', referring_agent_phone: '', referring_agency_name: '',
  receiving_agent_name: '', receiving_agent_email: '', receiving_agent_phone: '', receiving_agency_name: '',
  client_name: '', client_phone: '',
  property_community: '', property_address: '', property_type: 'apartment', transaction_type: 'sale',
  listing_price_aed: '', referral_commission_pct: '', referral_fee_aed: '',
  notes: '',
};

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 transition-colors ${className}`}
      {...props}
    />
  );
}

function Select({ children, className = '', ...props }) {
  return (
    <select
      className={`w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="col-span-2 flex items-center gap-2 mt-2">
      <span className="text-xs font-bold text-accent uppercase tracking-wider">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function FormAReferral() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['form-a-referrals'],
    queryFn: () => base44.entities.FormAReferral.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.FormAReferral.update(editingId, data)
      : base44.entities.FormAReferral.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-a-referrals'] });
      toast.success(editingId ? 'Referral updated' : 'Referral form created');
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FormAReferral.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-a-referrals'] });
      toast.success('Deleted');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.FormAReferral.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form-a-referrals'] }),
  });

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const openEdit = (r) => {
    setForm({ ...EMPTY_FORM, ...r });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (payload.listing_price_aed) payload.listing_price_aed = Number(payload.listing_price_aed);
    if (payload.referral_commission_pct) payload.referral_commission_pct = Number(payload.referral_commission_pct);
    if (payload.referral_fee_aed) payload.referral_fee_aed = Number(payload.referral_fee_aed);
    saveMutation.mutate(payload);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <FileSignature className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Form A — Co-Brokerage Referral</h1>
            <p className="text-xs text-muted-foreground">Agent-to-agent referral agreements</p>
          </div>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Referral
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.entries(STATUS_CONFIG).slice(0, 4).map(([key, cfg]) => (
          <div key={key} className="bg-card border border-border rounded-xl p-3">
            <p className="text-xs text-muted-foreground capitalize">{cfg.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {referrals.filter(r => r.status === key).length}
            </p>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <FileSignature className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No referral forms yet</p>
          <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }} className="text-accent text-sm font-medium hover:text-accent/80">
            + Create your first Form A Referral
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map(r => {
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">{r.client_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                      {r.transaction_type && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{r.transaction_type}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>From: <span className="text-foreground font-medium">{r.referring_agent_name}</span> ({r.referring_agency_name})</span>
                      <span>To: <span className="text-foreground font-medium">{r.receiving_agent_name}</span> ({r.receiving_agency_name})</span>
                      {r.property_community && <span>📍 {r.property_community}</span>}
                      {r.listing_price_aed && <span>AED {Number(r.listing_price_aed).toLocaleString()}</span>}
                      {r.referral_commission_pct && <span>Split: {r.referral_commission_pct}%</span>}
                    </div>
                    {r.created_date && (
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{format(new Date(r.created_date), 'dd MMM yyyy')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {r.status === 'draft' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'sent' })}
                        className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors"
                        title="Mark as Sent"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {r.status === 'sent' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'accepted' })}
                        className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
                        title="Mark as Accepted"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {r.status === 'accepted' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'completed' })}
                        className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                        title="Mark as Completed"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                      title="Edit"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(r.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-in Form Panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="w-full max-w-xl bg-card border-l border-border flex flex-col shadow-2xl overflow-y-auto">
            {/* Panel header */}
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <FileSignature className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="font-semibold text-foreground text-sm">
                  {editingId ? 'Edit Referral' : 'New Co-Brokerage Referral'}
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">

                <SectionHeader title="Referring Agent" />
                <FormField label="Agent Name *">
                  <Input required value={form.referring_agent_name} onChange={e => set('referring_agent_name', e.target.value)} placeholder="Sarah Al-Mansouri" />
                </FormField>
                <FormField label="Agency Name">
                  <Input value={form.referring_agency_name} onChange={e => set('referring_agency_name', e.target.value)} placeholder="Erudite Real Estate" />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={form.referring_agent_email} onChange={e => set('referring_agent_email', e.target.value)} placeholder="sarah@agency.ae" />
                </FormField>
                <FormField label="Phone">
                  <Input value={form.referring_agent_phone} onChange={e => set('referring_agent_phone', e.target.value)} placeholder="+971 50 xxx xxxx" />
                </FormField>

                <SectionHeader title="Receiving Agent" />
                <FormField label="Agent Name *">
                  <Input required value={form.receiving_agent_name} onChange={e => set('receiving_agent_name', e.target.value)} placeholder="Ahmed Hassan" />
                </FormField>
                <FormField label="Agency Name">
                  <Input value={form.receiving_agency_name} onChange={e => set('receiving_agency_name', e.target.value)} placeholder="Partner Real Estate" />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={form.receiving_agent_email} onChange={e => set('receiving_agent_email', e.target.value)} placeholder="ahmed@agency.ae" />
                </FormField>
                <FormField label="Phone">
                  <Input value={form.receiving_agent_phone} onChange={e => set('receiving_agent_phone', e.target.value)} placeholder="+971 55 xxx xxxx" />
                </FormField>

                <SectionHeader title="Client" />
                <FormField label="Client Name *">
                  <Input required value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="John Smith" />
                </FormField>
                <FormField label="Client Phone">
                  <Input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+971 50 xxx xxxx" />
                </FormField>

                <SectionHeader title="Property" />
                <FormField label="Community / Area">
                  <Input value={form.property_community} onChange={e => set('property_community', e.target.value)} placeholder="Business Bay" />
                </FormField>
                <FormField label="Address / Unit">
                  <Input value={form.property_address} onChange={e => set('property_address', e.target.value)} placeholder="Unit 1502, XYZ Tower" />
                </FormField>
                <FormField label="Property Type">
                  <Select value={form.property_type} onChange={e => set('property_type', e.target.value)}>
                    {['apartment','villa','townhouse','penthouse','studio','duplex','office','retail','land'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Transaction Type">
                  <Select value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)}>
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                  </Select>
                </FormField>
                <FormField label="Listing Price (AED)">
                  <Input type="number" value={form.listing_price_aed} onChange={e => set('listing_price_aed', e.target.value)} placeholder="2,500,000" />
                </FormField>

                <SectionHeader title="Commission Split" />
                <FormField label="Referral % (of total commission)">
                  <Input type="number" min="0" max="100" step="0.5" value={form.referral_commission_pct} onChange={e => set('referral_commission_pct', e.target.value)} placeholder="50" />
                </FormField>
                <FormField label="Referral Fee (AED)">
                  <Input type="number" value={form.referral_fee_aed} onChange={e => set('referral_fee_aed', e.target.value)} placeholder="25,000" />
                </FormField>

                <SectionHeader title="Notes" />
                <div className="col-span-2">
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={3}
                    placeholder="Any additional terms or remarks..."
                    className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 transition-colors resize-none"
                  />
                </div>

                {editingId && (
                  <>
                    <SectionHeader title="Status" />
                    <div className="col-span-2">
                      <Select value={form.status} onChange={e => set('status', e.target.value)}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2 pb-6">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editingId ? 'Update Referral' : 'Create Referral'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}