import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Building2, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EMPTY = {
  lead_id: '',
  landlord_id: '',
  property_ref: '',
  deal_type: 'sale',
  deal_value_aed: '',
  commission_amount_aed: '',
  commission_amount_buy_side_aed: '',
  assigned_agent_email: '',
  notes: '',
};

// Derives representation from which IDs are filled
function deriveRepr(leadId, landlordId) {
  if (leadId && landlordId) return 'both';
  if (leadId) return 'buyer_side';
  if (landlordId) return 'seller_side';
  return 'buyer_side';
}

export default function NewClosingDialog({ open, onClose, onSaved, prefillLeadId, prefillLandlordId, prefillPropertyRef, prefillProjectId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('full_name', 500),
    enabled: open,
  });

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords'],
    queryFn: () => base44.entities.Landlord.list('full_name_en', 500),
    enabled: open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    enabled: open,
  });

  // Pre-fill when triggered from a pipeline
  useEffect(() => {
    if (!open) return;
    const lead = leads.find(l => l.id === prefillLeadId);
    const landlord = landlords.find(l => l.id === prefillLandlordId);
    setForm({
      ...EMPTY,
      lead_id: prefillLeadId || '',
      landlord_id: prefillLandlordId || '',
      property_ref: prefillPropertyRef || landlord?.unit_reference || lead?.closing_property_ref || '',
      deal_value_aed: lead?.deal_value_aed || landlord?.asking_price_aed || '',
      assigned_agent_email: lead?.assigned_agent_email || landlord?.assigned_agent_email || '',
    });
  }, [open, prefillLeadId, prefillLandlordId, prefillPropertyRef, prefillProjectId]);

  if (!open) return null;

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.lead_id && !form.landlord_id) return toast.error('At least one of lead or landlord is required');
    setSaving(true);
    try {
      const lead = leads.find(l => l.id === form.lead_id);
      const landlord = landlords.find(l => l.id === form.landlord_id);
      const repr = deriveRepr(form.lead_id, form.landlord_id);

      // Project-scoped, null-guarded attach: ONLY match when BOTH project IDs are non-empty and equal,
      // AND normalized unit refs are equal. Two null/empty project IDs are never a match.
      const normalize = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
      const formProjectId = (lead?.closing_project_id || landlord?.project_id || '').trim();
      const formUnitRef = normalize(form.property_ref);

      let existing = null;
      if (formProjectId && formUnitRef) {
        const all = await base44.entities.ClosingDeal.list('-created_date', 200);
        existing = all.find(d => {
          const dProject = (d.closing_project_id || '').trim();
          const dUnit = normalize(d.property_ref);
          return dProject && dProject === formProjectId && dUnit === formUnitRef && d.stage !== 'complete';
        });
      }

      if (existing) {
        // Attach to existing deal
        const updates = { representation: repr };
        if (form.lead_id && !existing.lead_id) { updates.lead_id = form.lead_id; updates.lead_name = lead?.full_name || lead?.name || ''; }
        if (form.landlord_id && !existing.landlord_id) { updates.landlord_id = form.landlord_id; updates.landlord_name = landlord?.full_name_en || landlord?.full_name || ''; }
        // Ensure closing_project_id is stored on the deal if not already
        if (formProjectId && !existing.closing_project_id) { updates.closing_project_id = formProjectId; }
        await base44.entities.ClosingDeal.update(existing.id, updates);
        toast.success('Attached to existing closing deal');
      } else {
        // Generate reference
        const all = await base44.entities.ClosingDeal.list('-created_date', 500);
        const nextNum = (all.length + 1).toString().padStart(4, '0');

        const payload = {
          lead_id: form.lead_id || undefined,
          landlord_id: form.landlord_id || undefined,
          property_ref: form.property_ref || undefined,
          closing_project_id: formProjectId || undefined,
          lead_name: lead ? (lead.full_name || lead.name || '') : undefined,
          landlord_name: landlord ? (landlord.full_name_en || landlord.full_name || '') : undefined,
          representation: repr,
          deal_type: form.deal_type,
          deal_value_aed: form.deal_value_aed ? parseFloat(form.deal_value_aed) : undefined,
          commission_amount_aed: form.commission_amount_aed ? parseFloat(form.commission_amount_aed) : undefined,
          commission_amount_buy_side_aed: form.commission_amount_buy_side_aed ? parseFloat(form.commission_amount_buy_side_aed) : undefined,
          assigned_agent_email: form.assigned_agent_email || undefined,
          notes: form.notes || undefined,
          stage: 'not_started',
          stage_entered_at: new Date().toISOString(),
          closing_reference: `CLO-${nextNum}`,
          noc_status: 'not_required',
        };
        // strip undefined
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        await base44.entities.ClosingDeal.create(payload);
        toast.success('Closing deal created');
      }

      qc.invalidateQueries({ queryKey: ['closing_deals'] });
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const reprLabel = { buyer_side: 'Buyer Side Only', seller_side: 'Seller Side Only', both: 'Both Sides (Double-Ended)' };
  const reprColors = { buyer_side: 'rgba(59,130,246,0.15)', seller_side: 'rgba(245,158,11,0.15)', both: 'rgba(16,185,129,0.15)' };
  const reprBorder = { buyer_side: 'rgba(59,130,246,0.35)', seller_side: 'rgba(245,158,11,0.35)', both: 'rgba(16,185,129,0.35)' };
  const reprText   = { buyer_side: '#93c5fd', seller_side: 'hsl(38 92% 60%)', both: '#34d399' };
  const repr = deriveRepr(form.lead_id, form.landlord_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: 'hsl(222 47% 9%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <div>
            <h2 className="font-display text-xl font-semibold text-white">New Closing Deal</h2>
            <p className="text-xs text-white/40 mt-0.5">Fill in the parties, property and deal economics</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

          {/* ── Parties section ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Parties</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label flex items-center gap-1.5">
                  <User className="w-3 h-3 text-blue-400" /> Buyer (Lead)
                </label>
                <select value={form.lead_id} onChange={sf('lead_id')} className="field-input">
                  <option value="">— None (seller-side only) —</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.full_name || l.name || l.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-amber-400" /> Seller (Landlord)
                </label>
                <select value={form.landlord_id} onChange={sf('landlord_id')} className="field-input">
                  <option value="">— None (buyer-side only) —</option>
                  {landlords.map(l => (
                    <option key={l.id} value={l.id}>{l.full_name_en || l.full_name || l.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Representation badge */}
            {(form.lead_id || form.landlord_id) && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: reprColors[repr], border: `1px solid ${reprBorder[repr]}`, color: reprText[repr] }}>
                <span className="text-xs opacity-70">Representation:</span>
                {reprLabel[repr]}
              </div>
            )}
          </div>

          {/* ── Property section ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Property</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Property Reference</label>
                <input value={form.property_ref} onChange={sf('property_ref')} placeholder="e.g. UNIT-1204-MARINA" className="field-input" />
              </div>
              <div>
                <label className="field-label">Deal Type</label>
                <select value={form.deal_type} onChange={sf('deal_type')} className="field-input">
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Economics section ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Deal Economics</p>
            <div className="space-y-4">
              <div>
                <label className="field-label">Deal Value (AED)</label>
                <input type="number" value={form.deal_value_aed} onChange={sf('deal_value_aed')} placeholder="0" className="field-input text-lg font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Commission — Sell Side (AED)</label>
                  <input type="number" value={form.commission_amount_aed} onChange={sf('commission_amount_aed')} placeholder="0" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Commission — Buy Side (AED)</label>
                  <input type="number" value={form.commission_amount_buy_side_aed} onChange={sf('commission_amount_buy_side_aed')} placeholder="0" className="field-input" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Assignment & Notes ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Assignment & Notes</p>
            <div className="space-y-4">
              <div>
                <label className="field-label">Assigned Agent</label>
                <select value={form.assigned_agent_email} onChange={sf('assigned_agent_email')} className="field-input">
                  <option value="">— Select agent —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea value={form.notes} onChange={sf('notes')} rows={3} placeholder="Any additional notes…" className="field-input resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 shrink-0 flex gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
            {saving
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span>
              : 'Create Closing'}
          </button>
        </div>

        <style>{`
          .field-label { display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.4);margin-bottom:6px; }
          .field-input { width:100%;padding:10px 14px;border-radius:10px;font-size:14px;outline:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.9);transition:border-color 0.15s; }
          .field-input:focus { border-color:hsl(38 92% 50% / 0.6);box-shadow:0 0 0 3px hsl(38 92% 50% / 0.1); }
          select.field-input option { background:#1a1a2e;color:white; }
        `}</style>
      </div>
    </div>
  );
}