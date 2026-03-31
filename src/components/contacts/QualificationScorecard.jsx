import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { toast } from 'sonner';

const BUYER_QUESTIONS = [
  { key: 'budget_confirmed', label: 'Budget confirmed', desc: 'Do they know their exact range?' },
  { key: 'is_cash', label: 'Cash buyer (not mortgage)', desc: 'Pre-approved or liquid funds?' },
  { key: 'timeline_clear', label: 'Timeline is clear', desc: 'When do they need to move/buy?' },
  { key: 'decision_maker', label: 'Is the decision maker', desc: 'Can they sign without consulting someone else?' },
  { key: 'motivated', label: 'Motivated & serious', desc: 'Actively searching, not just browsing?' },
  { key: 'area_decided', label: 'Area/community decided', desc: 'Do they know where they want to live?' },
  { key: 'viewed_similar', label: 'Has viewed similar properties', desc: 'Do they have market comparison?' },
];

const TENANT_QUESTIONS = [
  { key: 'budget_confirmed', label: 'Budget confirmed', desc: 'Monthly or annual rent budget clear?' },
  { key: 'visa_status', label: 'Visa status confirmed', desc: 'UAE resident, tourist, or pending?' },
  { key: 'move_date', label: 'Move-in date known', desc: 'When do they need the property?' },
  { key: 'decision_maker', label: 'Is the decision maker', desc: 'Signing party confirmed?' },
  { key: 'motivated', label: 'Motivated & serious', desc: 'Actively looking, not just exploring?' },
  { key: 'area_decided', label: 'Area/community decided', desc: 'Specific area or open to options?' },
  { key: 'has_cheques', label: 'Cheques ready', desc: 'Can issue post-dated cheques?' },
];

const SELLER_QUESTIONS = [
  { key: 'motivated', label: 'Motivated to sell', desc: 'Why are they selling? Urgency?' },
  { key: 'price_realistic', label: 'Realistic on price', desc: 'Aligned with market value?' },
  { key: 'decision_maker', label: 'Is the decision maker', desc: 'All owners/signatories available?' },
  { key: 'title_deed_ready', label: 'Title deed available', desc: 'Documents ready for Form A?' },
  { key: 'property_vacant', label: 'Property is vacant', desc: 'Or vacant on transfer?' },
  { key: 'timeline_clear', label: 'Timeline is clear', desc: 'Flexible or urgent to close?' },
  { key: 'exclusive', label: 'Willing to give exclusive', desc: 'Open to signing Form A exclusive?' },
];

function getQuestions(type) {
  if (type === 'seller' || type === 'landlord') return SELLER_QUESTIONS;
  if (type === 'tenant') return TENANT_QUESTIONS;
  return BUYER_QUESTIONS;
}

export default function QualificationScorecard({ contactId, lead, onUpdate }) {
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();

  const qualData = lead?.custom_fields?.find(f => f.key === '__qualification')?.value;
  const answers = qualData ? JSON.parse(qualData) : {};

  const questions = getQuestions(lead?.relationship_type);
  const answered = questions.filter(q => answers[q.key] === true).length;
  const score = Math.round((answered / questions.length) * 100);

  const scoreColor = score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
  const scoreBg = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const saveMutation = useMutation({
    mutationFn: (newAnswers) => {
      const existing = (lead.custom_fields || []).filter(f => f.key !== '__qualification');
      return base44.entities.Lead.update(contactId, {
        custom_fields: [...existing, { key: '__qualification', value: JSON.stringify(newAnswers), type: 'text' }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const toggle = (key) => {
    const updated = { ...answers, [key]: !answers[key] };
    saveMutation.mutate(updated);
    if (onUpdate) onUpdate();
  };

  return (
    <div className="border-b border-[#F3F4F6]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-[#374151] uppercase tracking-wider">
          <Target className="w-3.5 h-3.5 text-[#9CA3AF]" />
          Qualification
          <span className={`ml-1 text-[11px] font-bold ${scoreColor}`}>{score}%</span>
        </span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scoreBg}`} style={{ width: `${score}%` }} />
          </div>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-1">
          <p className="text-[10px] text-[#9CA3AF] mb-3">
            {answered}/{questions.length} criteria met · {
              lead?.relationship_type
                ? `${lead.relationship_type} qualification`
                : 'buyer qualification'
            }
          </p>
          {questions.map((q) => {
            const checked = answers[q.key] === true;
            return (
              <button
                key={q.key}
                onClick={() => toggle(q.key)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                  checked ? 'bg-emerald-50 border border-emerald-100' : 'bg-[#FAFAFA] border border-[#F3F4F6] hover:border-[#E5E7EB]'
                }`}
              >
                {checked
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <Circle className="w-4 h-4 text-[#D1D5DB] shrink-0" />
                }
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${checked ? 'text-emerald-700' : 'text-[#374151]'}`}>{q.label}</p>
                  <p className="text-[10px] text-[#9CA3AF] truncate">{q.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}