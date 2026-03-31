import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Save, Loader2, CheckCircle2, XCircle, RefreshCw, FileText, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600 border-slate-200' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  countered: { label: 'Countered', color: 'bg-amber-100 text-amber-600 border-amber-200' },
  accepted:  { label: 'Accepted ✅', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  rejected:  { label: 'Rejected ❌', color: 'bg-red-100 text-red-600 border-red-200' },
  expired:   { label: 'Expired',   color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const NEXT_ACTIONS = {
  submitted: ['countered', 'accepted', 'rejected'],
  countered: ['submitted', 'accepted', 'rejected'],
  draft:     ['submitted'],
};

export default function OfferDetailPanel({ offer, onClose, onUpdate }) {
  const [draft, setDraft] = useState({ ...offer });
  const [isDirty, setIsDirty] = useState(false);
  const queryClient = useQueryClient();

  const set = (k, v) => { setDraft(d => ({ ...d, [k]: v })); setIsDirty(true); };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Offer.update(offer.id, data),
    onSuccess: (updated) => {
      setIsDirty(false);
      toast.success('Offer updated');
      onUpdate(updated);
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });

  const changeStatus = (status) => {
    const updates = { status };
    if (status === 'accepted') {
      updates.form_f_signed = true;
      // Promote lead stage to negotiation/offer_made
      if (offer.lead_id) {
        base44.entities.Lead.update(offer.lead_id, { stage: 'offer_made' })
          .then(() => queryClient.invalidateQueries({ queryKey: ['contacts'] }));
      }
    }
    saveMutation.mutate(updates);
    setDraft(d => ({ ...d, ...updates }));
    setIsDirty(false);
  };

  const discount = draft.asking_price_aed
    ? Math.round((1 - draft.offer_amount_aed / draft.asking_price_aed) * 100)
    : null;

  const nextActions = NEXT_ACTIONS[draft.status] || [];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-[#111827]">{draft.lead_name || 'Offer'}</h2>
          {draft.property_title && <p className="text-xs text-[#6B7280] mt-0.5">{draft.property_title}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_CONFIG[draft.status]?.color}`}>
            {STATUS_CONFIG[draft.status]?.label}
          </span>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Price Summary */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Offer Amount</p>
              <p className="text-xl font-bold text-indigo-700 mt-0.5">
                AED {draft.offer_amount_aed?.toLocaleString() || '—'}
              </p>
            </div>
            {draft.asking_price_aed && (
              <div>
                <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Asking Price</p>
                <p className="text-xl font-bold text-[#374151] mt-0.5">
                  AED {draft.asking_price_aed.toLocaleString()}
                </p>
                {discount !== null && (
                  <p className={`text-xs font-semibold mt-0.5 ${discount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {discount > 0 ? `${discount}% below asking` : `${Math.abs(discount)}% above asking`}
                  </p>
                )}
              </div>
            )}
          </div>
          {draft.counter_amount_aed && draft.status === 'countered' && (
            <div className="pt-3 border-t border-indigo-100">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Counter Offer</p>
              <p className="text-lg font-bold text-amber-700">AED {draft.counter_amount_aed.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Quick Status Change */}
        {nextActions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-2 uppercase tracking-wider">Update Status</p>
            <div className="flex gap-2 flex-wrap">
              {nextActions.map(status => (
                <Button
                  key={status}
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus(status)}
                  disabled={saveMutation.isPending}
                  className={`h-8 text-xs border ${STATUS_CONFIG[status]?.color}`}
                >
                  {STATUS_CONFIG[status]?.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Editable Fields */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#374151] uppercase tracking-wider">Offer Details</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#9CA3AF] font-medium block mb-1">Offer Amount (AED)</label>
              <Input
                type="number"
                value={draft.offer_amount_aed || ''}
                onChange={e => set('offer_amount_aed', Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#9CA3AF] font-medium block mb-1">Counter Amount (AED)</label>
              <Input
                type="number"
                value={draft.counter_amount_aed || ''}
                onChange={e => set('counter_amount_aed', Number(e.target.value))}
                placeholder="If countered"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#9CA3AF] font-medium block mb-1">Deal Type</label>
              <select
                value={draft.deal_type || 'sale'}
                onChange={e => set('deal_type', e.target.value)}
                className="w-full h-8 text-xs px-2 rounded-lg border border-[#E5E7EB] bg-white focus:outline-none focus:border-indigo-400"
              >
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#9CA3AF] font-medium block mb-1">Completion Date</label>
              <Input
                type="date"
                value={draft.completion_date || ''}
                onChange={e => set('completion_date', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-4 pt-1">
            {[
              { key: 'form_f_signed', label: 'Form F / MOU Signed' },
              { key: 'noc_required', label: 'NOC Required' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft[key] || false}
                  onChange={e => set(key, e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-indigo-500"
                />
                <span className="text-xs text-[#374151]">{label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="text-[10px] text-[#9CA3AF] font-medium block mb-1">Notes</label>
            <textarea
              value={draft.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Notes, terms, special conditions…"
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-none focus:border-indigo-400 min-h-[72px] resize-none"
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="text-[10px] text-[#9CA3AF] space-y-1 border-t border-[#F3F4F6] pt-3">
          <p>Created: {offer.created_date ? format(new Date(offer.created_date), 'MMM d, yyyy') : '—'}</p>
          {offer.submitted_at && <p>Submitted: {format(new Date(offer.submitted_at), 'MMM d, yyyy HH:mm')}</p>}
        </div>
      </div>

      {/* Save Bar */}
      {isDirty && (
        <div className="flex-shrink-0 px-5 py-3 bg-white border-t border-[#E5E7EB] flex items-center justify-between">
          <span className="text-xs text-[#9CA3AF]">Unsaved changes</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setDraft({ ...offer }); setIsDirty(false); }} className="h-7 text-xs">Discard</Button>
            <Button size="sm" onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending}
              className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white gap-1">
              {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}