// magicReshapeNote — deep-context note rewriter.
// A NOTE is the agent communicating WITH the AI system/brain — educating it about
// barriers, what's happening, what the landlord said/did, what's blocking the deal.
// This function rewrites the agent's rough note into clear, structured intelligence
// that the brain can consume effectively on its next orchestrator run.
//
// Merges THREE brains (same as magicReshapeV2):
//   1. THE BRAIN  — landlord AI intelligence (deal thesis, coaching, objections, momentum)
//   2. THE UNIT   — unit reference, project, asking price, stage, mandate
//   3. THE CONVO   — recent messages across all channels (so the note doesn't repeat)
//
// Input:  { landlord_id, text }
// Output: { ok, message }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { landlord_id, text } = body;
    if (!landlord_id || !text?.trim?.()) {
      return Response.json({ error: 'Missing landlord_id or text' }, { status: 400 });
    }

    // ── 1. THE BRAIN — landlord record with all AI intelligence fields ──
    const ll = await base44.asServiceRole.entities.Landlord.get(landlord_id);

    // ── 2. THE CONVO — recent messages across every channel ──
    const safeFilter = async (entityName, sort, limit) => {
      try {
        return await base44.asServiceRole.entities[entityName].filter({ landlord_id }, sort, limit);
      } catch { return []; }
    };

    const [wa, ems, ims, tgs, notes] = await Promise.all([
      safeFilter('Message', '-timestamp', 15),
      safeFilter('Email', '-received_at', 5),
      safeFilter('IMessage', '-sent_at', 5),
      safeFilter('TelegramMessage', '-created_date', 5),
      safeFilter('LandlordNote', '-created_date', 3),
    ]);

    const conv: any[] = [];
    (wa || []).forEach((m: any) => conv.push({
      ts: m.timestamp, channel: 'WhatsApp',
      dir: m.direction === 'incoming' ? '← landlord' : '→ landlord',
      text: m.text || '',
    }));
    (ems || []).forEach((e: any) => conv.push({
      ts: e.received_at, channel: 'Email',
      dir: e.direction === 'inbound' ? '← landlord' : '→ landlord',
      text: e.snippet || e.body_text || e.subject || '',
    }));
    (ims || []).forEach((m: any) => conv.push({
      ts: m.sent_at, channel: 'iMessage',
      dir: m.direction === 'inbound' ? '← landlord' : '→ landlord',
      text: m.body || '',
    }));
    (tgs || []).forEach((m: any) => conv.push({
      ts: m.created_date, channel: 'Telegram',
      dir: m.direction === 'inbound' ? '← landlord' : '→ landlord',
      text: m.text || m.body || '',
    }));
    (notes || []).forEach((n: any) => conv.push({
      ts: n.created_date, channel: 'Note',
      dir: 'internal',
      text: n.body || n.content || n.text || '',
    }));

    conv.sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime());
    const convText = conv.slice(0, 12)
      .map((c) => `[${c.channel} ${c.dir}] ${c.text || '(no text)'}`)
      .join('\n');

    // ── 3. Build the BRAIN context ──
    const brain: string[] = [];
    if (ll.ai_deal_thesis) brain.push(`CURRENT DEAL THESIS: ${ll.ai_deal_thesis}`);
    if (ll.ai_rolling_summary) brain.push(`SITUATION SUMMARY: ${ll.ai_rolling_summary}`);
    if (ll.ai_next_best_action?.action) brain.push(`NEXT BEST ACTION: ${ll.ai_next_best_action.action}`);
    if (ll.ai_coaching_for_agent) brain.push(`COACHING: ${ll.ai_coaching_for_agent}`);
    if (ll.ai_objections?.length) brain.push(`KNOWN OBJECTIONS: ${ll.ai_objections.join('; ')}`);
    if (ll.ai_momentum) brain.push(`MOMENTUM: ${ll.ai_momentum}`);
    if (ll.rapport_level) brain.push(`RAPPORT: ${ll.rapport_level}`);
    if (ll.stage) brain.push(`PIPELINE STAGE: ${ll.stage}`);
    if (ll.trust_score) brain.push(`TRUST SCORE: ${ll.trust_score}/100`);
    if (ll.ai_strike_now) brain.push(`⚡ STRIKE NOW SIGNAL ACTIVE`);

    // ── 4. Build the UNIT context ──
    const unit: string[] = [];
    if (ll.full_name_en) unit.push(`Owner: ${ll.full_name_en}`);
    if (ll.unit_reference) unit.push(`Unit: ${ll.unit_reference}`);
    if (ll.project_name) unit.push(`Project: ${ll.project_name}`);
    if (ll.asking_price_aed) unit.push(`Asking: AED ${ll.asking_price_aed}`);
    if (ll.preferred_language) unit.push(`Language: ${ll.preferred_language}`);
    if (ll.nationality) unit.push(`Nationality: ${ll.nationality}`);

    // ── 5. Call LLM ──
    const prompt =
      `You are an AI assistant helping a real-estate agent write a BETTER INTERNAL NOTE.\n\n` +
      `CONTEXT: A note is NOT a message to the landlord. It is the agent educating the AI system (the "brain") about what is happening with this deal — barriers, new information, what the landlord said or did, what's blocking progress, and what the agent plans to do next. The brain reads this note on its next orchestrator run to update its strategy.\n\n` +
      `TASK: Rewrite the agent's rough note below into clear, structured, actionable intelligence that the brain can consume effectively.\n\n` +
      `You have THREE sources of intelligence:\n\n` +
      `=== 1. THE BRAIN (current AI strategic analysis) ===\n` +
      `${brain.length ? brain.join('\n') : '(No brain data yet)'}\n\n` +
      `=== 2. THE UNIT (property details) ===\n` +
      `${unit.length ? unit.join('\n') : '(No unit details)'}\n\n` +
      `=== 3. THE CONVERSATION (recent cross-channel history, most recent first) ===\n` +
      `${convText || '(No recent conversation)'}\n\n` +
      `=== AGENT'S ROUGH NOTE TO IMPROVE ===\n${text}\n\n` +
      `RULES:\n` +
      `- The note should STRUCTURE the agent's information into clear intelligence. Use short sections with labels like "BARRIER:", "LANDLORD FEEDBACK:", "NEW INFO:", "NEXT STEP:", "RISK:" where appropriate.\n` +
      `- Do NOT repeat information already in the conversation history or brain — only capture what is NEW or CHANGED.\n` +
      `- Be specific: reference exact unit number, project, prices, dates, or names the agent mentioned.\n` +
      `- If the agent mentioned a barrier or objection, make it crystal clear what the barrier is and why it matters.\n` +
      `- If the agent mentioned a next step or plan, state it as a concrete action item.\n` +
      `- Keep the agent's original meaning — do not invent facts, buyers, prices, or events that aren't in the note or context.\n` +
      `- Write in the SAME language as the agent's original note.\n` +
      `- Be concise. No fluff, no preamble, no "Here is the improved note:" — output ONLY the structured note.\n` +
      `- Use plain text with line breaks and uppercase section labels for structure.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: { type: 'object', properties: { message: { type: 'string' } } },
    });

    const message = res?.message || (typeof res === 'string' ? res : '');
    if (!message) throw new Error('No message returned from LLM');

    return Response.json({ ok: true, message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});