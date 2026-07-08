// FounderBossVoiceButton — AI refiner that rewrites the founder's rough notes
// into a polished, professional boss-voice directive, grounded in the landlord's
// live context (stage, days, momentum, lens stats). Admin-only.
//
// Uses InvokeLLM directly (no backend function needed — it's a stateless text
// transformation). Shows loading state, offers an undo if the founder dislikes
// the rewrite.

import React, { useState } from 'react';
import { Sparkles, Loader2, Undo2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GOLD = '#C9A24B';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

export default function FounderBossVoiceButton({
  draftText,
  onApply,
  landlordId,
  landlord,
  lens,
  compact = true,
}) {
  const [refining, setRefining] = useState(false);
  const [prevText, setPrevText] = useState(null);

  const buildContext = () => {
    const parts = [];
    parts.push(`Landlord: ${landlord?.full_name_en || landlord?.full_name || 'Unknown'}`);
    parts.push(`Stage: ${landlord?.stage || 'unknown'}`);
    if (lens?.daysInStage != null) parts.push(`Days in current stage: ${lens.daysInStage}`);
    if (lens?.totalTouches != null) parts.push(`Total outbound touches logged: ${lens.totalTouches}`);
    if (lens?.aiMomentum) parts.push(`AI momentum: ${lens.aiMomentum}`);
    if (landlord?.asking_price_aed) parts.push(`Asking price: AED ${landlord.asking_price_aed.toLocaleString()}`);
    if (landlord?.project_name) parts.push(`Project: ${landlord.project_name}`);
    if (landlord?.unit_reference) parts.push(`Unit: ${landlord.unit_reference}`);
    if (landlord?.mandate_type) parts.push(`Mandate type: ${landlord.mandate_type}`);
    if (landlord?.mandate_status) parts.push(`Mandate status: ${landlord.mandate_status}`);
    if (landlord?.ai_rolling_summary) parts.push(`AI summary: ${String(landlord.ai_rolling_summary).slice(0, 400)}`);
    if (landlord?.ai_next_best_action?.action) parts.push(`AI next-best-action: ${landlord.ai_next_best_action.action}`);
    if (landlord?.assigned_agent_email) parts.push(`Assigned agent: ${landlord.assigned_agent_email}`);
    return parts.join('\n');
  };

  const handleRefine = async () => {
    if (!draftText.trim()) {
      toast.error('Write something first — even rough notes work.');
      return;
    }
    setRefining(true);
    try {
      const prompt = `You are the founder of a Dubai real-estate brokerage, speaking to one of your agents about a specific landlord deal. 

The founder's raw notes (what they actually want to say):
"""
${draftText.trim()}
"""

Live landlord context:
${buildContext()}

Rewrite the founder's notes as a polished FOUNDER DIRECTIVE — a clear, actionable instruction the agent reads and acts on. 

VOICE & TONE:
- Speak as the boss: warm but authoritative. You are the founder — you see the big picture, you care about the agent's success, and you know exactly what needs to happen.
- Be direct and specific. No corporate fluff, no hedging. The agent should know precisely what to prioritize and why.
- Be understanding — acknowledge the human element (the agent's effort, the landlord's situation) before giving the instruction.
- Keep it to 2-4 sentences. One clear ask. Ground it in the landlord's actual stage, momentum, or context above.
- Do NOT use placeholders like {{agent_name}}. Write as if speaking directly to the agent right now.
- Do NOT invent facts not present in the context. If context is thin, keep the directive general but still actionable.

Output ONLY the directive text — no preamble, no quotes, no markdown formatting.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            directive: { type: 'string', description: 'The polished founder directive text, ready to issue.' },
          },
          required: ['directive'],
        },
      });

      const refined = result?.directive || result?.data?.directive;
      if (!refined || typeof refined !== 'string') {
        throw new Error('AI returned no directive text');
      }

      setPrevText(draftText);
      onApply(refined.trim());
      toast.success('Refined in boss voice');
    } catch (err) {
      toast.error('Refinement failed: ' + (err?.message || 'unknown'));
    } finally {
      setRefining(false);
    }
  };

  const handleUndo = () => {
    if (prevText != null) {
      onApply(prevText);
      setPrevText(null);
      toast.success('Reverted to your original');
    }
  };

  const canUndo = prevText != null && draftText !== prevText;

  return (
    <div style={css('display:flex; align-items:center; gap:4px;')}>
      <button
        type="button"
        onClick={handleRefine}
        disabled={refining || !draftText.trim()}
        title="Refine in boss voice — AI rewrites your notes as a polished founder directive"
        style={css(
          'display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:7px; ' +
          'font-size:10px; font-weight:600; cursor:pointer; font-family:"Inter",sans-serif; ' +
          'background:rgba(201,162,75,0.1); color:' + GOLD + '; border:1px solid rgba(201,162,75,0.3); ' +
          'transition:background 0.15s, border-color 0.15s; ' +
          (refining || !draftText.trim() ? 'opacity:0.5; cursor:not-allowed;' : '')
        )}
      >
        {refining ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        {compact ? '' : 'Boss Voice'}
      </button>
      {canUndo && (
        <button
          type="button"
          onClick={handleUndo}
          title="Revert to your original text"
          style={css(
            'display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; ' +
            'border-radius:7px; cursor:pointer; background:rgba(255,255,255,0.04); ' +
            'border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4);'
          )}
        >
          <Undo2 size={11} />
        </button>
      )}
    </div>
  );
}