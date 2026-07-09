import React, { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GRANT_CARDONE_PERSONA } from '@/lib/grantCardoneVoice';
import {
  Brain, Sparkles, Loader2, ChevronDown, ChevronUp, Copy, Check,
  Target, Clock, Wallet, FileSignature, Users, KeyRound, Landmark,
  UserCheck, ShieldAlert, MessageCircle, Languages,
} from 'lucide-react';

/*
 * CallBrainPanel — live "what to ask" coach for landlord qualification calls.
 *
 * Two layers:
 *   1. A deterministic Dubai-grounded question bank that reacts to the form
 *      state — it surfaces the qualification gaps still to uncover, instantly,
 *      with no API latency (useful the moment the agent picks up the phone).
 *   2. "Ask Brain AI" — an InvokeLLM call that tailors questions, likely
 *      objections + rebuttals, and Dubai compliance flags to THIS landlord
 *      and everything captured so far on the call.
 */

// ── Dubai-grounded question bank ────────────────────────────────────────────
// Each area maps to a qualification field. `filled` decides whether the area is
// already captured on the current call so we can prioritise what's still open.
// Questions reflect Dubai selling practice: RERA Form A / exclusivity, developer
// NOC + service-charge clearance, mortgage liability letter & early-settlement
// cap, tenanted-vs-vacant + Ejari / eviction notice, joint title / POA for
// overseas owners.

const BANK = [
  {
    key: 'motivation',
    label: 'Motivation',
    icon: Target,
    filled: f => !!f.motivation || !!f.motivation_notes,
    questions: [
      "What's prompting you to think about selling right now?",
      'Is this more a lifestyle move — relocating, upgrading — or purely about the numbers on the investment?',
      'If you sold, what would you do with the proceeds — reinvest in Dubai, or move capital out?',
    ],
    tip: "Motivation drives everything. A relocating or distressed owner is far more negotiable than someone just testing the market.",
  },
  {
    key: 'timeline_urgency',
    label: 'Timeline / Urgency',
    icon: Clock,
    filled: f => !!f.timeline_urgency,
    questions: [
      'If we brought you the right buyer this month, how quickly would you want to close?',
      'Are you working toward a specific date — a visa, a school term, or another purchase?',
      "Bear in mind a resale transfer typically takes 4–6 weeks once we're under Form F — does that fit your plans?",
    ],
    tip: 'Anchor urgency to a real deadline. "ASAP" with no date usually means no rush.',
  },
  {
    key: 'price',
    label: 'Price Expectation',
    icon: Wallet,
    filled: f => !!f.price_expectation_aed || !!f.price_vs_valuation,
    questions: [
      'What figure did you have in mind for the unit?',
      'Have you seen the recent DLD transactions for your building and layout? The last comparable closed around AED —.',
      'Is that a firm number, or is there room for a strong cash buyer with no mortgage delay?',
    ],
    tip: 'Ground price against actual DLD closes, not portal asking prices. Portals are aspirational; DLD is truth.',
  },
  {
    key: 'mandate_openness',
    label: 'Mandate / Exclusivity',
    icon: FileSignature,
    filled: f => !!f.mandate_openness,
    questions: [
      'Have you already signed a Form A listing agreement with any agent?',
      'Would you consider giving one agent exclusivity for a short window, so we can invest in professional photography, portal boosts and a proper launch?',
      'How do you feel about your unit sitting on ten different agents’ listings at ten different prices?',
    ],
    tip: 'Form A is the RERA listing agreement. Exclusive mandates let you invest in marketing; open listings become a price race to the bottom.',
  },
  {
    key: 'competing_brokers',
    label: 'Competing Brokers',
    icon: Users,
    filled: f => !!f.competing_brokers,
    questions: [
      'Are other agents already marketing the unit — and roughly how many?',
      'Is it already live on Property Finder or Bayut? At what price?',
      'How have those agents performed so far — any real offers, or just enquiries?',
    ],
    tip: 'Knowing the competition tells you how to differentiate — and whether the owner is realistic about pricing.',
  },
  {
    key: 'tenancy_status',
    label: 'Tenancy Status',
    icon: KeyRound,
    filled: f => !!f.tenancy_status || !!f.available_from,
    questions: [
      'Is the unit vacant, owner-occupied, or tenanted right now?',
      'If tenanted — when does the current Ejari / lease expire, and has any vacating or eviction notice been served?',
      'If a buyer needs vacant possession, would the tenant consider an early cash-for-keys exit?',
    ],
    tip: 'A tenanted unit sells to investors; vacant sells to end-users at a premium. Eviction needs 12 months’ notarised notice — flag it early.',
  },
  {
    key: 'mortgage_status',
    label: 'Mortgage Status',
    icon: Landmark,
    filled: f => !!f.mortgage_status,
    questions: [
      'Is there a mortgage on the property — with a local bank or an overseas one?',
      "Do you know roughly the outstanding balance? We'll need a liability / settlement letter for the developer NOC.",
      'Just so you know — early settlement is capped at 1% of the balance or AED 10,000, whichever is lower, plus a small release fee.',
    ],
    tip: 'A mortgaged sale adds ~2–3 weeks (bank liability letter, blocking, release). Overseas mortgages are slower — surface it now.',
  },
  {
    key: 'is_decision_maker',
    label: 'Decision Maker',
    icon: UserCheck,
    filled: f => !!f.is_decision_maker,
    questions: [
      'Are you the sole owner on the title deed, or is it jointly held / under a company?',
      'Will anyone else need to sign off on a sale — a spouse, partner, or co-owner?',
      "If you're overseas for the transfer, is there a POA holder here, or would we arrange a notarised power of attorney?",
    ],
    tip: 'Every owner on the title must sign at transfer. Overseas owners need a UAE-attested POA — line it up before you get an offer.',
  },
];

// Dubai process flags worth raising even when not a form field.
const DUBAI_FLAGS = [
  { icon: FileSignature, text: 'Are all service charges & developer dues cleared? The developer NOC (5–10 days, AED 500–5,000) depends on it.' },
  { icon: ShieldAlert, text: 'Selling above AED 2M can affect a Golden Visa tied to the property — check before advising.' },
  { icon: Clock, text: 'Off-plan / pre-handover? Confirm the developer allows resale and what the transfer fee / % paid threshold is.' },
];

// ── UI helpers ──────────────────────────────────────────────────────────────

const AI_BLUE = 'rgba(96,165,250,';

function QuestionRow({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="group flex items-start gap-2 py-1">
      <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: `${AI_BLUE}0.5)` }} />
      <p className="text-[11px] leading-snug flex-1" style={{ color: 'rgba(255,255,255,0.72)' }}>{text}</p>
      <button
        onClick={copy}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
        title="Copy question"
      >
        {copied
          ? <Check className="w-3 h-3 text-emerald-400" />
          : <Copy className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />}
      </button>
    </div>
  );
}

function AreaCard({ area, dimmed }) {
  const [open, setOpen] = useState(!dimmed);
  const Icon = area.icon;
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        background: dimmed ? 'rgba(255,255,255,0.02)' : `${AI_BLUE}0.05)`,
        borderColor: dimmed ? 'rgba(255,255,255,0.06)' : `${AI_BLUE}0.18)`,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: dimmed ? 'rgba(255,255,255,0.3)' : `${AI_BLUE}0.85)` }} />
        <span className="text-[11px] font-semibold flex-1" style={{ color: dimmed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.82)' }}>
          {area.label}
        </span>
        {dimmed && <Check className="w-3 h-3 text-emerald-500/70 shrink-0" title="Already captured" />}
        {open ? <ChevronUp className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
              : <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />}
      </button>
      {open && (
        <div className="px-2.5 pb-2 pt-0.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {area.questions.map((q, i) => <QuestionRow key={i} text={q} />)}
          {area.tip && (
            <p className="mt-1.5 text-[10px] italic leading-snug pl-3" style={{ color: `${AI_BLUE}0.55)` }}>
              💡 {area.tip}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const LANGS = [
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', label: 'Arabic', flag: '🇦🇪' },
];

export default function CallBrainPanel({ landlord, form }) {
  const [open, setOpen] = useState(false);
  const [ai, setAi] = useState(null);
  const [aiOriginal, setAiOriginal] = useState(null);
  const [lang, setLang] = useState(null); // null = original English
  const [translating, setTranslating] = useState(false);

  const gaps = useMemo(() => BANK.filter(a => !a.filled(form)), [form]);
  const covered = useMemo(() => BANK.filter(a => a.filled(form)), [form]);

  const translate = async (targetCode) => {
    if (!ai || translating) return;
    setTranslating(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following JSON from English to ${targetCode === 'ru' ? 'Russian' : targetCode === 'zh' ? 'Chinese (Simplified)' : 'Arabic'}. Keep the same structure. Translate ALL text values (opening, question, why, area, trigger, response, flags). Return the translated JSON with the exact same keys.\n\n${JSON.stringify(ai)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            opening: { type: 'string' },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string' },
                  question: { type: 'string' },
                  why: { type: 'string' },
                },
              },
            },
            objections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  trigger: { type: 'string' },
                  response: { type: 'string' },
                },
              },
            },
            flags: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      setAi(res);
      setLang(targetCode);
    } catch {
      // silently fail — original text stays
    } finally {
      setTranslating(false);
    }
  };

  const brainMutation = useMutation({
    mutationFn: async () => {
      const context = [
        `Owner: ${landlord?.full_name_en || landlord?.full_name || 'Unknown'}`,
        landlord?.project_name && `Building / project: ${landlord.project_name}`,
        landlord?.unit_reference && `Unit: ${landlord.unit_reference}`,
        landlord?.residence_country && `Owner resides in: ${landlord.residence_country}`,
        landlord?.landlord_archetype && `Archetype: ${landlord.landlord_archetype}`,
        landlord?.mandate_status && `Mandate status: ${landlord.mandate_status}`,
        landlord?.rapport_level && `Rapport level: ${landlord.rapport_level}`,
        landlord?.red_flags && `Known red flags: ${landlord.red_flags}`,
        landlord?.ai_rolling_summary && `History summary: ${landlord.ai_rolling_summary}`,
        '',
        'Captured so far on THIS call:',
        form.motivation && `- Motivation: ${form.motivation} ${form.motivation_notes ? `(${form.motivation_notes})` : ''}`,
        form.timeline_urgency && `- Timeline: ${form.timeline_urgency}`,
        form.price_expectation_aed && `- Price expectation: AED ${Number(form.price_expectation_aed).toLocaleString()}`,
        form.price_vs_valuation && `- Price vs valuation: ${form.price_vs_valuation}`,
        form.mandate_openness && `- Mandate openness: ${form.mandate_openness}`,
        form.competing_brokers && `- Competing brokers: ${form.competing_brokers}`,
        form.tenancy_status && `- Tenancy: ${form.tenancy_status}`,
        form.mortgage_status && `- Mortgage: ${form.mortgage_status}`,
        form.is_decision_maker && `- Decision maker: ${form.is_decision_maker}`,
      ].filter(Boolean).join('\n');

      const prompt = `${GRANT_CARDONE_PERSONA}

You are whispering in the ear of an agent during a LIVE qualification call with a property owner (a potential seller / landlord) in Dubai. Your job is to tell the agent exactly what to ask next to win an exclusive mandate and qualify the deal. You are a CLOSER — every question you suggest should advance toward inking the Form A. Push hard. Assume the close.

Ground everything in Dubai selling reality: RERA Form A listing agreements & exclusivity, developer NOC and service-charge clearance, mortgage liability letters and the 1%/AED 10,000 early-settlement cap, tenanted vs vacant possession and the 12-month notarised eviction notice / cash-for-keys, joint title & POA for overseas owners, DLD 4% transfer fee, and Form F (MOU) closing.

${context}

Do NOT repeat questions for information already captured above. Focus on the biggest open gaps and on advancing toward an exclusive mandate. Be specific, natural, and phrased exactly as the agent should say them out loud — in Grant's voice: direct, urgent, assume-the-close. Keep it concise — this is real-time.`;

      return base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            opening: { type: 'string', description: 'One natural rapport / transition line the agent can use right now, tailored to this owner.' },
            questions: {
              type: 'array',
              description: '4-7 prioritised questions to ask next, most valuable first.',
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string', description: 'Short label e.g. Price, Mandate, Tenancy.' },
                  question: { type: 'string', description: 'Exact wording to say out loud.' },
                  why: { type: 'string', description: 'One-line reason this matters now.' },
                },
              },
            },
            objections: {
              type: 'array',
              description: 'Likely objections from this owner and a crisp rebuttal.',
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
              description: 'Dubai process / compliance reminders relevant to this specific deal.',
              items: { type: 'string' },
            },
          },
          required: ['questions'],
        },
      });
    },
    onSuccess: data => { setAi(data); setAiOriginal(data); setLang(null); },
  });

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ background: `${AI_BLUE}0.04)`, borderColor: `${AI_BLUE}0.18)` }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors"
        style={{ background: open ? `${AI_BLUE}0.06)` : 'transparent' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${AI_BLUE}0.15)` }}>
            <Brain className="w-4 h-4" style={{ color: `${AI_BLUE}0.95)` }} />
          </div>
          <div>
            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: `${AI_BLUE}0.95)` }}>
              🧠 Brain AI — What to Ask
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {gaps.length > 0
                ? `${gaps.length} qualification ${gaps.length === 1 ? 'area' : 'areas'} still to uncover`
                : 'Core areas covered — tap for Dubai flags & AI coaching'}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
              : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t" style={{ borderColor: `${AI_BLUE}0.1)` }}>
          {/* Ask Brain AI */}
          <button
            onClick={() => brainMutation.mutate()}
            disabled={brainMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
            style={{ background: `${AI_BLUE}0.16)`, color: `${AI_BLUE}0.95)`, border: `1px solid ${AI_BLUE}0.3)` }}
          >
            {brainMutation.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading the room…</>
              : <><Sparkles className="w-3.5 h-3.5" /> {ai ? 'Refresh AI coaching' : 'Ask Brain AI for this owner'}</>}
          </button>

          {brainMutation.isError && (
            <p className="text-[10px] text-red-400 px-1">Couldn't reach Brain AI. The suggested questions below still apply.</p>
          )}

          {/* AI results */}
          {ai && (
            <div className="rounded-lg border p-2.5 space-y-2.5" style={{ background: `${AI_BLUE}0.06)`, borderColor: `${AI_BLUE}0.22)` }}>
              {/* Translate bar */}
              <div className="flex items-center gap-1.5 flex-wrap pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[9px] uppercase tracking-wider font-bold flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <Languages className="w-2.5 h-2.5" /> Translate
                </span>
                <button
                  onClick={() => { if (lang !== null && aiOriginal) { setLang(null); setAi(aiOriginal); } }}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
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
                    className="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
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

              {ai.opening && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: `${AI_BLUE}0.6)` }}>Say this now</p>
                  <p className="text-[11px] italic leading-snug" style={{ color: 'rgba(255,255,255,0.8)' }}>"{ai.opening}"</p>
                </div>
              )}
              {Array.isArray(ai.questions) && ai.questions.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: `${AI_BLUE}0.6)` }}>Ask next</p>
                  <div className="space-y-1.5">
                    {ai.questions.map((q, i) => (
                      <div key={i}>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[10px] font-bold shrink-0 mt-0.5" style={{ color: `${AI_BLUE}0.7)` }}>{i + 1}.</span>
                          <div className="flex-1">
                            <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.82)' }}>{q.question}</p>
                            {q.why && <p className="text-[9.5px] italic mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{q.why}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              {Array.isArray(ai.flags) && ai.flags.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1" style={{ color: 'rgba(245,158,11,0.7)' }}>
                    <ShieldAlert className="w-2.5 h-2.5" /> Dubai process flags
                  </p>
                  {ai.flags.map((fl, i) => (
                    <p key={i} className="text-[10px] leading-snug flex gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <span style={{ color: 'rgba(245,158,11,0.7)' }}>•</span> {fl}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deterministic gap-driven script */}
          {gaps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider font-bold px-0.5" style={{ color: `${AI_BLUE}0.6)` }}>
                Still to uncover
              </p>
              {gaps.map(area => <AreaCard key={area.key} area={area} dimmed={false} />)}
            </div>
          )}

          {/* Dubai flags (static) */}
          <div className="rounded-lg border p-2.5" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.18)' }}>
            <p className="text-[9px] uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1" style={{ color: 'rgba(245,158,11,0.75)' }}>
              <ShieldAlert className="w-2.5 h-2.5" /> Don't forget (Dubai)
            </p>
            <div className="space-y-1">
              {DUBAI_FLAGS.map((fl, i) => (
                <p key={i} className="text-[10px] leading-snug flex gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ color: 'rgba(245,158,11,0.7)' }}>•</span> {fl.text}
                </p>
              ))}
            </div>
          </div>

          {/* Covered areas (collapsed, dimmed) */}
          {covered.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider font-bold px-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Already covered ({covered.length})
              </p>
              {covered.map(area => <AreaCard key={area.key} area={area} dimmed />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}