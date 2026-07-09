import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { GRANT_CARDONE_PERSONA_COMPACT } from '@/lib/grantCardoneVoice';

// useFieldInsights — debounced AI "smart note" generator for the call qualification
// form. As the agent answers each question, this calls InvokeLLM ONCE (debounced)
// with ALL currently-answered fields and returns a map of { fieldKey: insight }.
// Cached by a signature of the answered set so unchanged forms don't re-fetch.
//
// Returns { insights, loading }
//   insights: { [fieldKey]: string } — one-line AI insight per answered field
//   loading:   boolean — true while the debounced LLM call is in flight

const FIELD_LABELS = {
  motivation: 'Motivation',
  motivation_notes: 'Motivation notes',
  timeline_urgency: 'Timeline / urgency',
  price_expectation_aed: 'Price expectation',
  price_vs_valuation: 'Price vs valuation',
  mandate_openness: 'Mandate openness',
  competing_brokers: 'Competing brokers',
  tenancy_status: 'Tenancy status',
  available_from: 'Available from',
  mortgage_status: 'Mortgage status',
  is_decision_maker: 'Decision maker',
  call_outcome: 'Call outcome',
  rapport_after_call: 'Rapport after call',
  next_step: 'Next step',
  followup_date: 'Follow-up date',
  agent_notes: 'Agent notes',
};

export function useFieldInsights(form, landlord) {
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(false);
  const lastSigRef = useRef('');
  const cacheRef = useRef({}); // sig -> { [fieldKey]: insight }

  useEffect(() => {
    // Collect answered fields + build a stable signature.
    const keys = Object.keys(FIELD_LABELS);
    const answered = keys
      .map((k) => ({ key: k, value: form[k] }))
      .filter((f) => f.value !== undefined && f.value !== null && String(f.value).trim() !== '');

    if (answered.length === 0) {
      setInsights({});
      lastSigRef.current = '';
      return;
    }

    const sig = answered.map((f) => `${f.key}=${f.value}`).join('|');

    // Already have insights for this exact set of answers — no re-fetch.
    if (sig === lastSigRef.current || cacheRef.current[sig]) {
      if (cacheRef.current[sig]) setInsights(cacheRef.current[sig]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const labelize = (v) => String(v).replace(/_/g, ' ');
        const qaBlock = answered
          .map((f) => `- ${FIELD_LABELS[f.key]}: ${labelize(f.value)}`)
          .join('\n');
        const ownerName = landlord?.full_name_en || landlord?.full_name || 'the owner';
        const ctx = [
          `Owner: ${ownerName}`,
          landlord?.project_name && `Project: ${landlord.project_name}`,
          landlord?.asking_price_aed && `Asking: AED ${Number(landlord.asking_price_aed).toLocaleString()}`,
          landlord?.landlord_archetype && `Archetype: ${landlord.landlord_archetype}`,
        ].filter(Boolean).join('\n');

        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `${GRANT_CARDONE_PERSONA_COMPACT}

You are coaching an agent LIVE on a qualification call with ${ownerName}. For each answer captured below, write ONE short, sharp insight line (max ~14 words) that tells the agent what that answer MEANS for the deal and what to watch for. Be specific, practical, and grounded in Dubai selling reality (RERA Form A, developer NOC, mortgage liability letters, tenanted vs vacant, POA for overseas owners). Push toward the close. Do NOT repeat the answer back — add interpretation only.

LANDLORD CONTEXT:
${ctx}

ANSWERS CAPTURED SO FAR:
${qaBlock}

Return a JSON object with an "insights" array. Each item has "key" (the field key, exactly as given below) and "insight" (one line). Only include keys that were answered.

Field keys: ${answered.map((f) => f.key).join(', ')}`,
          response_json_schema: {
            type: 'object',
            properties: {
              insights: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    insight: { type: 'string' },
                  },
                },
              },
            },
            required: ['insights'],
          },
        });

        const list = Array.isArray(res?.insights) ? res.insights : [];
        const map = {};
        list.forEach((it) => {
          if (it && it.key && it.insight) map[it.key] = it.insight;
        });
        cacheRef.current[sig] = map;
        lastSigRef.current = sig;
        setInsights(map);
      } catch {
        // silently fail — insights are a nice-to-have, not blocking
      } finally {
        setLoading(false);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [form, landlord]);

  return { insights, loading };
}