import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Plus, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Building2, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const OUTCOMES = [
  { value: 'pending', label: 'Pending', color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { value: 'interested', label: 'Interested ✅', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'not_interested', label: 'Not Interested ❌', color: 'text-red-500 bg-red-50 border-red-200' },
  { value: 'needs_options', label: 'Needs More Options 🔍', color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { value: 'offer_likely', label: 'Offer Likely 🔥', color: 'text-orange-500 bg-orange-50 border-orange-200' },
];

export default function ViewingTracker({ contactId, contactName }) {
  const [open, setOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ property_name: '', date: '', notes: '' });
  const queryClient = useQueryClient();

  const { data: viewings = [] } = useQuery({
    queryKey: ['viewings', contactId],
    queryFn: () => base44.entities.Reminder.filter(
      { lead_id: contactId, type: 'viewing' },
      '-due_date',
      20
    ),
    enabled: !!contactId,
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Reminder.create({
      title: `Viewing: ${form.property_name || 'Property'}`,
      type: 'viewing',
      lead_id: contactId,
      lead_name: contactName,
      due_date: form.date ? new Date(form.date).toISOString() : null,
      notes: form.notes,
      status: 'pending',
      tags: ['viewing'],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewings', contactId] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-briefing'] });
      setForm({ property_name: '', date: '', notes: '' });
      setShowForm(false);
      toast.success('Viewing scheduled');
    },
  });

  const updateOutcomeMutation = useMutation({
    mutationFn: ({ id, outcome, nextAction }) => {
      const updates = { metadata: { viewing_outcome: outcome } };
      if (outcome === 'not_interested') updates.status = 'completed';
      return base44.entities.Reminder.update(id, updates);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['viewings', contactId] });
      // Auto-create follow-up reminder if interested
      if (['interested', 'offer_likely'].includes(vars.outcome)) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        base44.entities.Reminder.create({
          title: `Follow up after viewing`,
          type: 'follow_up',
          lead_id: contactId,
          lead_name: contactName,
          due_date: tomorrow.toISOString(),
          status: 'pending',
          priority: vars.outcome === 'offer_likely' ? 'high' : 'medium',
        }).then(() => queryClient.invalidateQueries({ queryKey: ['reminders'] }));
        toast.success('Follow-up reminder auto-created for tomorrow');
      }
    },
  });

  const pending = viewings.filter(v => v.status === 'pending');
  const done = viewings.filter(v => v.status !== 'pending');

  return (
    <div className="border-b border-[#F3F4F6]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-[#374151] uppercase tracking-wider">
          <Eye className="w-3.5 h-3.5 text-[#9CA3AF]" />
          Viewings
          {viewings.length > 0 && (
            <span className="ml-1 text-[11px] font-bold text-blue-500">{viewings.length}</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); setShowForm(v => !v); setOpen(true); }}
            className="text-[10px] text-indigo-500 font-medium hover:text-indigo-700 flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" /> Schedule
          </button>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {/* Add Form */}
          {showForm && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Schedule Viewing</p>
              <Input
                value={form.property_name}
                onChange={e => setForm(f => ({ ...f, property_name: e.target.value }))}
                placeholder="Property name / address"
                className="h-7 text-xs"
              />
              <Input
                type="datetime-local"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="h-7 text-xs"
              />
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                className="h-7 text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white flex-1">
                  Schedule Viewing
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-7 text-xs">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Pending viewings */}
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map(v => {
                const outcome = v.metadata?.viewing_outcome;
                return (
                  <div key={v.id} className="border border-[#E5E7EB] rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#111827] truncate">{v.title}</p>
                        {v.due_date && (
                          <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {format(new Date(v.due_date), 'EEE MMM d · h:mm a')}
                          </p>
                        )}
                        {v.notes && <p className="text-[10px] text-[#6B7280] mt-0.5 line-clamp-1">{v.notes}</p>}
                      </div>
                      {outcome && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${OUTCOMES.find(o => o.value === outcome)?.color || ''}`}>
                          {OUTCOMES.find(o => o.value === outcome)?.label}
                        </span>
                      )}
                    </div>
                    {/* Outcome selector */}
                    <div className="flex flex-wrap gap-1">
                      <p className="text-[10px] text-[#9CA3AF] w-full mb-0.5">Outcome:</p>
                      {OUTCOMES.filter(o => o.value !== 'pending').map(o => (
                        <button
                          key={o.value}
                          onClick={() => updateOutcomeMutation.mutate({ id: v.id, outcome: o.value })}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all hover:scale-105 ${
                            outcome === o.value ? o.color : 'bg-white text-[#9CA3AF] border-[#E5E7EB] hover:border-[#D1D5DB]'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Past viewings */}
          {done.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Past Viewings</p>
              {done.slice(0, 3).map(v => (
                <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAFA] border border-[#F3F4F6]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D1D5DB] shrink-0" />
                  <p className="text-xs text-[#9CA3AF] truncate flex-1">{v.title}</p>
                  {v.metadata?.viewing_outcome && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${OUTCOMES.find(o => o.value === v.metadata.viewing_outcome)?.color || ''}`}>
                      {OUTCOMES.find(o => o.value === v.metadata.viewing_outcome)?.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {viewings.length === 0 && !showForm && (
            <p className="text-xs text-[#9CA3AF] italic text-center py-2">No viewings yet — schedule one above</p>
          )}
        </div>
      )}
    </div>
  );
}