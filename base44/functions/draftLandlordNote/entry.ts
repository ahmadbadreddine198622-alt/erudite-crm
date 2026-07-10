import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * draftLandlordNote — generates a FRESH note draft for the Notes tab AI-draft control,
 * grounded in the latest call qualification OR the latest WhatsApp conversation for this
 * landlord. Replaces the stale landlord-level rolling-summary snapshot (which only changes
 * when Analyse is re-run) with a context-specific summary the agent can save as a note.
 *
 * Body params: { landlord_id: string, source: 'call' | 'conversation' }
 * Returns: { ok: true, text: string }  — text is a 2-4 sentence note draft (English, internal).
 */

const fmtDate = (d) => { if (!d) return '?'; const x = new Date(d); return isNaN(x) ? String(d) : x.toISOString().slice(0, 16).replace('T', ' '); };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, source = 'conversation' } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });
    if (!['call', 'conversation'].includes(source)) {
      return Response.json({ error: "source must be 'call' or 'conversation'" }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const landlord = await svc.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    let contextBlock = '';
    let contextLabel = '';

    if (source === 'call') {
      // Latest structured call qualification = the richest "call summary" we store.
      const quals = await svc.entities.CallQualification.filter({ landlord_id }, '-call_date', 3).catch(() => []);
      const latest = quals?.[0] || null;
      if (!latest) {
        return Response.json({ ok: false, error: 'No call qualification logged for this landlord yet.' });
      }
      contextLabel = `latest logged call (${fmtDate(latest.call_date)})`;
      contextBlock = `CALL QUALIFICATION:
- When: ${fmtDate(latest.call_date)}
- Motivation: ${latest.motivation || '?'}
- Timeline urgency: ${latest.timeline_urgency || '?'}
- Price expectation (AED): ${latest.price_expectation_aed ?? '?'}
- Price vs valuation: ${latest.price_vs_valuation || '?'}
- Mandate openness: ${latest.mandate_openness || '?'}
- Call outcome: ${latest.call_outcome || '?'}
- Next step: ${latest.next_step || '?'}
- Agent notes: ${latest.agent_notes || '(none)'}`;
    } else {
      // Latest conversation messages (oldest→newest in the prompt).
      const messages = await svc.entities.Message.filter({ landlord_id }, '-timestamp', 40).catch(() => []);
      if (!messages || messages.length === 0) {
        return Response.json({ ok: false, error: 'No conversation messages for this landlord yet.' });
      }
      const convo = messages.slice().reverse().map((m) => {
        const who = m.direction === 'incoming' ? 'LANDLORD' : 'AGENT';
        const body = m.is_voice_note
          ? `[voice] ${m.transcript || ''}${m.translated_text ? ` (EN: ${m.translated_text})` : ''}`
          : (m.text || m.caption || `[${m.media_type || 'media'}]`);
        return `[${fmtDate(m.timestamp)}] ${who}: ${String(body).slice(0, 400)}`;
      }).join('\n');
      contextLabel = `last ${messages.length} WhatsApp messages`;
      contextBlock = `CONVERSATION (oldest→newest):
${convo}`;
    }

    const prompt = `You are writing an INTERNAL CRM NOTE for a Dubai real-estate agent, summarizing the ${contextLabel} with a landlord.

LANDLORD: ${landlord.full_name_en || landlord.full_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`}
Stage: ${landlord.stage || '?'} | Project/Unit: ${landlord.project_name || '?'} ${landlord.unit_reference || ''}

${contextBlock}

Write a concise, factual note draft (2-4 sentences, English, first-person as the agent) that captures:
- What was said / decided / agreed
- Any price, timeline, motivation, or objection signals
- The immediate next step implied

Do NOT invent facts not present in the context. Do NOT address the landlord directly (this is an internal note, not a message to them). No placeholders, no signatures. Return ONLY the note text.`;

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: { type: 'object', properties: { note_draft: { type: 'string' } }, required: ['note_draft'] },
    });

    const text = (llmRes && (llmRes.note_draft || (typeof llmRes === 'string' ? llmRes : ''))) || '';
    const clean = String(text).trim();
    if (!clean) return Response.json({ ok: false, error: 'AI returned an empty draft' });

    return Response.json({ ok: true, source, text: clean });
  } catch (error) {
    console.error('draftLandlordNote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});