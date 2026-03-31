import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OfferFormDialog({ onClose, onCreated, prefillLeadId, prefillLeadName }) {
  const [form, setForm] = useState({
    lead_id: prefillLeadId || '',
    lead_name: prefillLeadName || '',
    property_title: '',
    offer_amount_aed: '',
    asking_price_aed: '',
    deal_type: 'sale',
    status: 'submitted',
    notes: '',
    form_f_signed: false,
    noc_required: false,
    completion_date: '',
  });
  const [leadSearch, setLeadSearch] = useState(prefillLeadName || '');

  const { data: leads = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
    enabled: !prefillLeadId,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 100),
  });

  const filteredLeads = leads.filter(l =>
    leadSearch && l.name?.toLowerCase().includes(leadSearch.toLowerCase())
  ).slice(0, 5);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Offer.create({
      ...data,
      offer_amount_aed: Number(data.offer_amount_aed),
      asking_price_aed: data.asking_price_aed ? Number(data.asking_price_aed) : undefined,
      submitted_at: new Date().toISOString(),
    }),
    onSuccess: (offer) => {
      toast.success('Offer created');
      onCreated(offer);
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-base font-bold text-[#111827]">New Offer</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] p-1 rounded-lg hover:bg-[#F3F4F6] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Lead */}
          {!prefillLeadId ? (
            <div className="relative">
              <label className="text-xs font-medium text-[#374151] block mb-1">Lead / Client *</label>
              <Input
                value={leadSearch}
                onChange={e => { setLeadSearch(e.target.value); set('lead_name', e.target.value); }}
                placeholder="Search lead name…"
                className="h-9 text-sm"
              />
              {filteredLeads.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden">
                  {filteredLeads.map(l => (
                    <button key={l.id} onClick={() => {
                      set('lead_id', l.id);
                      set('lead_name', l.name);
                      setLeadSearch(l.name);
                    }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors">
                      {l.name}
                      {l.phone && <span className="text-xs text-[#9CA3AF] ml-2">{l.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1">Lead / Client</label>
              <p className="text-sm font-semibold text-[#111827] px-3 py-2 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">{prefillLeadName}</p>
            </div>
          )}

          {/* Property */}
          <div>
            <label className="text-xs font-medium text-[#374151] block mb-1">Property</label>
            <select
              value={form.property_title}
              onChange={e => {
                const prop = properties.find(p => p.title === e.target.value);
                set('property_title', e.target.value);
                if (prop) { set('property_id', prop.id); set('asking_price_aed', prop.price_aed || ''); }
              }}
              className="w-full h-9 text-sm px-3 rounded-lg border border-[#E5E7EB] bg-white focus:outline-none focus:border-indigo-400"
            >
              <option value="">Select or type a property…</option>
              {properties.map(p => (
                <option key={p.id} value={p.title}>{p.title} — AED {p.price_aed?.toLocaleString()}</option>
              ))}
            </select>
            {!form.property_id && (
              <Input
                value={form.property_title}
                onChange={e => set('property_title', e.target.value)}
                placeholder="Or type property name manually"
                className="h-8 text-xs mt-1"
              />
            )}
          </div>

          {/* Deal type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1">Deal Type</label>
              <select value={form.deal_type} onChange={e => set('deal_type', e.target.value)}
                className="w-full h-9 text-sm px-3 rounded-lg border border-[#E5E7EB] bg-white focus:outline-none focus:border-indigo-400">
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full h-9 text-sm px-3 rounded-lg border border-[#E5E7EB] bg-white focus:outline-none focus:border-indigo-400">
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="countered">Countered</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1">Offer Amount (AED) *</label>
              <Input
                type="number"
                value={form.offer_amount_aed}
                onChange={e => set('offer_amount_aed', e.target.value)}
                placeholder="e.g. 2500000"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1">Asking Price (AED)</label>
              <Input
                type="number"
                value={form.asking_price_aed}
                onChange={e => set('asking_price_aed', e.target.value)}
                placeholder="e.g. 2800000"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Completion date */}
          <div>
            <label className="text-xs font-medium text-[#374151] block mb-1">Expected Completion Date</label>
            <Input
              type="date"
              value={form.completion_date}
              onChange={e => set('completion_date', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex gap-4">
            {[
              { key: 'form_f_signed', label: 'Form F / MOU Signed' },
              { key: 'noc_required', label: 'NOC Required' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => set(key, e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-indigo-500"
                />
                <span className="text-xs text-[#374151]">{label}</span>
              </label>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[#374151] block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Terms, conditions, special requests…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-none focus:border-indigo-400 min-h-[72px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E5E7EB] flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="h-8 text-xs">Cancel</Button>
          <Button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.lead_id || !form.offer_amount_aed || createMutation.isPending}
            className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white gap-1"
          >
            {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Create Offer
          </Button>
        </div>
      </div>
    </div>
  );
}