import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GRANT_CARDONE_PERSONA } from '@/lib/grantCardoneVoice';
import { DUBAI_FLAGS } from './qualifyQuestionBank';
import {
  Brain, Sparkles, Loader2, ChevronDown, ChevronUp,
  MessageCircle, ShieldAlert, Languages, Lightbulb,
} from 'lucide-react';

const AI_BLUE = 'rgba(96,165,250,';
const LANGS = [
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', label: 'Arabic', flag: '🇦🇪' },
];

// BrainCoachSection — the AI coaching layer inside BrainQualifyFlow.
// Generates: opening rapport line, likely objections + rebuttals, Dubai flags,
// and a "focus next" hint — all tailored to the landlord and current answers.
// Includes translate to RU / ZH / AR.

export default function BrainCoachSection({ landlord, form, answeredCount }) {
  const [open, setOpen] = useState(false);
  const [ai, setAi] = useState(null);
  const [aiOriginal, setAiOriginal] = useState(null);
  const [lang, setLang] = useState(null);
  const [translating, setTranslating] = useState(false);

  const coachMutation = useMutation({
    mutationFn: async () => {
      const context = [
        `Owner: ${landlord?.full_name_en || landlord?.full_name || 'Unknown'}`,
        landlord?.project_name && `Project: ${landlord.project_name}`,
        landlord?.unit_reference && `Unit: ${landlord.unit_reference}`,
        landlord?.residence_country && `Owner resides in: ${landlord.residence_country}`,
        landlord?.landlord_archetype && `Archetype: ${landlord.landlord_archetype}`,
        landlord?.mandate_status && `Mandate status: ${landlord.mandate_status}`,
        landlord?.rapport_level && `Rapport: ${landlord.rapport_level}`,
        landlord?.red_flags?.length && `Red flags: ${landlord.red_flags.join(', ')}`,
        landlord?.ai_rolling_summary && `History: ${landlord.ai_rolling_summary}`,
        '',
        'Answers captured so far on THIS call:',
        form.motivation && `- Motivation: ${form.motivation}${form.motivation_notes ? ` (${form.motivation_notes})` : ''}`,
        form.timeline_urgency && `- Timeline: ${form.timeline_urgency}`,
        form.price_expectation_aed && `- Price expectation: AED ${Number(form.price_expectation_aed).toLocaleString()}`,
        form.price_vs_valuation && `- Price vs valuation: ${form.price_vs_valuation}`,
        form.mandate_openness && `- Mandate openness: ${form.mandate_openness}`,
        form.competing_brokers && `- Competing brokers: ${form.competing_brokers}`,
        form.tenancy_status && `- Tenancy: ${form.tenancy_status}`,
        form.mortgage_status && `- Mortgage: ${form.mortgage_status}`,
        form.is_decision_maker && `- Decision maker: ${form.is_decision_maker}`,
        form.call_outcome && `- Call outcome: ${form.call_outcome}`,
      ].filter(Boolean).join('\n');

      const prompt = `${GRANT_CARDONE_PERSONA}

You are the BRAIN inside a Dubai real estate CRM, whispering in the ear of an agent during a LIVE qualification call with a property owner. Your job: coach the agent to WIN an exclusive mandate and close the deal. Push hard. Assume the close. Every word should advance toward inking the Form A.

Ground everything in Dubai selling reality: RERA Form A, developer NOC, mortgage liability letters (1%/AED 10k early-settlement cap), tenanted vs vacant (12-month notarised eviction), joint title & POA for overseas owners, DLD 4% transfer fee, Form F (MOU) closing.

${context}

Based on what's captured so far (${answeredCount} fields filled), generate:
1. An opening rapport / transition line the agent can say RIGHT NOW.
2. 2-4 likely objections from THIS owner and a crisp, Grant Cardone-style rebuttal for each.
3. 1-3 Dubai compliance / process flags relevant to this specific deal.
4. Which qualification area the agent should focus on NEXT and why (priority_hint).

Be concise — this is real-time. Do NOT repeat info already captured.`;

      return base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            opening: { type: 'string', description: 'One natural rapport/transition line the agent can say right now.' },
            objections: {
              type: 'array',
              description: 'Likely objections from this owner + a crisp rebuttal.',
              items: {
                type: 'object',
                properties: {
                  trigger: { type: 'string' },
                  response: { type: 'string' },
                },
              },
            },
            flags: {
              type: 'array',
              description: 'Dubai process/compliance reminders relevant to this deal.',
              items: { type: 'string' },
            },
            priority_hint: {
              type: 'object',
              properties: {
                area: { type: 'string', description: 'Which qualification area to focus on next.' },
                reason: { type: 'string' },
              },
            },
          },
        },
      });
    },
    onSuccess: data => { setAi(data); setAiOriginal(data); setLang(null); setOpen(true); },
  });

  const translate = async (targetCode) => {
    if (!ai || translating) return;
    setTranslating(true);
    try {
      const langName = targetCode === 'ru' ? 'Russian' : targetCode === 'zh' ? 'Chinese (Simplified)' : 'Arabic';
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate this JSON from English to ${langName}. Keep structure + keys. Translate ALL text values.\n\n${JSON.stringify(ai)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            opening: { type: 'string' },
            objections: { type: 'array', items: { type: 'object', properties: { trigger: { type: 'string' }, response: { type: 'string' } } } },
            flags: { type: 'array', items: { type: 'string' } },
            priority_hint: { type: 'object', properties: { area: { type: 'string' }, reason: { type: 'string' } } },
          },
        },
      });
      setAi(res);
      setLang(targetCode);
    } catch { /* keep original */ } finally { setTranslating(false); }
  };

  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: `${AI_BLUE}0.04)`, borderColor: `${AI_BLUE}0.18)` }}>
      {/* Header / Ask button */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${AI_BLUE}0.15)` }}>
          <Brain className="w-4 h-4" style={{ color: `${AI_BLUE}0.95)` }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold" style={{ color: `${AI_BLUE}0.95)` }}>🧠 Brain Coach</span>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {ai ? 'AI coaching ready' : 'Get AI-powered coaching for this call'}
          </p>
        </div>
        <button
          onClick={() => (ai ? setOpen(o => !o) : coachMutation.mutate())}
          disabled={coachMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-60 shrink-0"
          style={{ background: `${AI_BLUE}0.16)`, color: `${AI_BLUE}0.95)`, border: `1px solid ${AI_BLUE}0.3)` }}
        >
          {coachMutation.isPending
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</>
            : ai
            ? <>{open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {open ? 'Hide' : 'Show'}</>
            : <><Sparkles className="w-3 h-3" /> Ask Brain AI</>}
        </button>
      </div>

      {/* AI coaching content */}
      {open && ai && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t" style={{ borderColor: `${AI_BLUE}0.1)` }}>
          {/* Translate bar */}
          <div className="flex items-center gap-1.5 flex-wrap pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[9px] uppercase tracking-wider font-bold flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Languages className="w-2.5 h-2.5" /> Translate
            </span>
            <button
              onClick={() => { if (lang !== null && aiOriginal) { setLang(null); setAi(aiOriginal); } }}
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{
                background: lang === null ? `${AI_BLUE}0.2)` : 'rgba(255,255,255,0.04)',
                color: lang === null ? `${AI_BLUE}0.95)` : 'rgba(255,255,255,0.5)',
                border: `1px solid ${lang === null ? `${AI_BLUE}0.35)` : 'rgba(255,255,255,0.08)'}`,
              }}
            >EN</button>
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => translate(l.code)}
                disabled={translating}
                className="px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 disabled:opacity-50"
                style={{
                  background: lang === l.code ? `${AI_BLUE}0.2)` : 'rgba(255,255,255,0.04)',
                  color: lang === l.code ? `${AI_BLUE}0.95)` : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${lang === l.code ? `${AI_BLUE}0.35)` : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {l.flag} {l.label}
                {translating && lang === l.code && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              </button>
            ))}
          </div>

          {/* Opening line */}
          {ai.opening && (
            <div>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: `${AI_BLUE}0.6)` }}>Say this now</p>
              <p className="text-[11px] italic leading-snug" style={{ color: 'rgba(255,255,255,0.8)' }}>"{ai.opening}"</p>
            </div>
          )}

          {/* Priority hint */}
          {ai.priority_hint?.area && (
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: `${AI_BLUE}0.06)`, border: `1px solid ${AI_BLUE}0.15)` }}>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1" style={{ color: `${AI_BLUE}0.6)` }}>
                <Lightbulb className="w-2.5 h-2.5" /> Focus next
              </p>
              <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{ai.priority_hint.area}</p>
              {ai.priority_hint.reason && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{ai.priority_hint.reason}</p>}
            </div>
          )}

          {/* Objections */}
          {Array.isArray(ai.objections) && ai.objections.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1" style={{ color: `${AI_BLUE}0.6)` }}>
                <MessageCircle className="w-2.5 h-2.5" /> If they push back
              </p>
              <div className="space-y-1.5">
                {ai.objections.map((o, i) => (
                  <div key={i} className="rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>"{o.trigger}"</p>
                    <p className="text-[10.5px] mt-0.5 leading-snug" style={{ color: `${AI_BLUE}0.8)` }}>→ {o.response}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI flags */}
          {Array.isArray(ai.flags) && ai.flags.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1" style={{ color: 'rgba(245,158,11,0.7)' }}>
                <ShieldAlert className="w-2.5 h-2.5" /> AI Dubai flags
              </p>
              {ai.flags.map((fl, i) => (
                <p key={i} className="text-[10px] leading-snug flex gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ color: 'rgba(245,158,11,0.7)' }}>•</span> {fl}
                </p>
              ))}
            </div>
          )}

          {/* Static Dubai flags */}
          <div className="rounded-lg border p-2.5" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.18)' }}>
            <p className="text-[9px] uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1" style={{ color: 'rgba(245,158,11,0.75)' }}>
              <ShieldAlert className="w-2.5 h-2.5" /> Don't forget (Dubai)
            </p>
            {DUBAI_FLAGS.map((fl, i) => (
              <p key={i} className="text-[10px] leading-snug flex gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ color: 'rgba(245,158,11,0.7)' }}>•</span> {fl}
              </p>
            ))}
          </div>
        </div>
      )}

      {coachMutation.isError && (
        <p className="text-[10px] text-red-400 px-3 pb-2">Couldn't reach Brain AI. The guided questions still work.</p>
      )}
    </div>
  );
}