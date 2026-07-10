import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// generateCallReport — after an agent finishes logging a qualification call,
// the AI reads every Q&A captured on the call, builds a structured call report,
// and persists it as a LandlordNote (→ Notes tab + Activity stream) and a
// Followup (→ Follow-up tab + Activity stream) when a next step / date exists.
//
// Input:
//   landlord_id    — FK to Landlord
//   qualification  — the CallQualification form object (all Q&A fields)
//   agent_email    — the logging agent's email (optional, falls back to me())
//   agent_name     — display name (optional)
//
// Returns: { ok, report_text, note_id, followup_id }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const landlordId = body.landlord_id;
    const q = body.qualification || {};
    const agentEmail = body.agent_email || user.email || '';
    const agentName = body.agent_name || user.full_name || (user.email ? user.email.split('@')[0] : 'Agent');

    if (!landlordId) return Response.json({ error: 'landlord_id is required' }, { status: 400 });

    const L = await base44.asServiceRole.entities.Landlord.get(landlordId);
    if (!L) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    const ownerName = L.full_name_en || L.full_name || 'the owner';

    // ── Build the Q&A context from the qualification form ──
    const labelize = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const qaLines = [
      q.motivation && `Motivation: ${labelize(q.motivation)}${q.motivation_notes ? ` — "${q.motivation_notes}"` : ''}`,
      q.timeline_urgency && `Timeline / urgency: ${labelize(q.timeline_urgency)}`,
      q.price_expectation_aed && `Price expectation: AED ${Number(q.price_expectation_aed).toLocaleString()}`,
      q.price_vs_valuation && `Price vs valuation: ${labelize(q.price_vs_valuation)}`,
      q.mandate_openness && `Mandate openness: ${labelize(q.mandate_openness)}`,
      q.competing_brokers && `Competing brokers: ${q.competing_brokers}`,
      q.tenancy_status && `Tenancy: ${labelize(q.tenancy_status)}`,
      q.available_from && `Available from: ${q.available_from}`,
      q.mortgage_status && `Mortgage: ${labelize(q.mortgage_status)}`,
      q.is_decision_maker && `Decision maker: ${labelize(q.is_decision_maker)}`,
      q.call_outcome && `Call outcome: ${labelize(q.call_outcome)}`,
      q.rapport_after_call && `Rapport after call: ${labelize(q.rapport_after_call)}`,
      q.next_step && `Next step agreed: ${q.next_step}`,
      q.followup_date && `Follow-up date: ${q.followup_date}`,
      q.agent_notes && `Agent notes: ${q.agent_notes}`,
    ].filter(Boolean);

    if (qaLines.length === 0) {
      return Response.json({ ok: false, error: 'No qualification data captured yet' }, { status: 200 });
    }

    const landlordContext = [
      `Owner: ${ownerName}`,
      L.project_name && `Building / project: ${L.project_name}`,
      L.unit_reference && `Unit: ${L.unit_reference}`,
      L.unit_layout && `Layout: ${L.unit_layout}`,
      L.asking_price_aed && `Asking price: AED ${Number(L.asking_price_aed).toLocaleString()}`,
      L.residence_country && `Owner resides in: ${L.residence_country}`,
      L.landlord_archetype && `Archetype: ${L.landlord_archetype}`,
      L.mandate_status && `Mandate status: ${L.mandate_status}`,
      L.rapport_level && `Rapport level: ${L.rapport_level}`,
      L.ai_rolling_summary && `Prior history: ${L.ai_rolling_summary}`,
    ].filter(Boolean).join('\n');

    // ── Fetch Grant Cardone persona from the voice function ──
    let persona = '';
    try {
      const pv = await base44.asServiceRole.functions.invoke('grantCardoneVoice', {});
      persona = (pv?.data?.persona || pv?.persona || '').trim();
    } catch (_) { /* persona is a nice-to-have; fallback to built-in below */ }
    if (!persona) {
      persona = 'PERSONA: You speak like Grant Cardone — direct, urgent, zero-hedging. Nothing happens until you close. Every objection is a buying signal. Time kills deals — speed closes them. Push toward action. Assume the close.';
    }

    const prompt = `${persona}

You are an elite Dubai real estate analyst AND a ruthless closer. An agent just finished a qualification call with a property owner (potential seller / landlord). Below is everything captured on the call, plus the landlord context. Build a concise, hard-hitting CALL REPORT that the agent's team can read to understand exactly what happened on the call and what to do next. Write it in Grant Cardone's voice: direct, urgent, no hedging, always pushing toward the close.

Ground everything in Dubai selling reality: RERA Form A / exclusivity, developer NOC + service-charge clearance, mortgage liability letters + 1%/AED 10,000 early-settlement cap, tenanted vs vacant possession + 12-month notarised eviction notice, joint title / POA for overseas owners, DLD 4% transfer fee, Form F (MOU) closing.

LANDLORD CONTEXT:
${landlordContext}

CAPTURED ON THE CALL (Q&A):
${qaLines.join('\n')}

Write the report as clean markdown with these sections:
## Call Summary
2-3 sentences on what happened and where the deal stands.
## Key Facts
Bullet list of the most important facts uncovered (price, timeline, motivation, mandate, tenancy, mortgage, decision maker).
## Read on the Owner
1-2 sentences on temperature, motivation strength, and how ready they are to move.
## Risks / Flags
Bullet list of deal risks or Dubai compliance flags to watch (or "None surfaced" if clean).
## Recommended Next Steps
2-4 numbered, concrete next actions for the agent.
## One-line Verdict
A single punchy Grant Cardone-style line summarising the deal's health. No hedging — "This deal is hot, close it now" or "This deal is dead unless you move today." Pick a side.

Be specific and grounded in the captured data — do not invent facts. Keep it tight and skimmable. Write every word like a closer, not a visitor.`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          report: { type: 'string', description: 'The full markdown call report' },
        },
        required: ['report'],
      },
    });

    const reportText = (res && (res.report || res.data?.report)) || '';
    if (!reportText) return Response.json({ ok: false, error: 'AI returned no report' }, { status: 200 });

    // ── Persist the report as a LandlordNote (→ Notes tab + Activity stream) ──
    const noteBody = `📞 CALL REPORT — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n${reportText}`;
    const note = await base44.asServiceRole.entities.LandlordNote.create({
      landlord_id: landlordId,
      author_email: agentEmail,
      author_name: agentName,
      body: noteBody,
      created_from_ai: true,
      ai_source: 'call_qualification_report',
      was_edited_after_draft: false,
      pinned: false,
    });

    // ── If a next step / follow-up date was captured, create a Followup (→ Follow-up tab + Activity) ──
    let followupId = null;
    const nextStep = q.next_step && String(q.next_step).trim();
    const followupDate = q.followup_date && String(q.followup_date).trim();
    if (nextStep || followupDate) {
      const date = followupDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      let hour = 10;
      try { hour = new Date().getHours(); if (hour < 8) hour = 10; if (hour > 19) hour = 16; } catch (_) {}
      const hh = String(hour).padStart(2, '0');
      const datetime = `${date}T${hh}:00:00+04:00`;
      try {
        const fu = await base44.asServiceRole.entities.Followup.create({
          landlord_id: landlordId,
          title: nextStep ? nextStep.slice(0, 120) : 'Call follow-up',
          notes: nextStep || 'Follow up after qualification call',
          scheduled_at: datetime,
          status: 'pending',
          priority: (q.call_outcome && /interested|proceeding/i.test(q.call_outcome)) ? 'high' : 'normal',
          kind: 'follow_up',
          agent_email: agentEmail,
          created_from_ai: true,
        });
        followupId = fu && fu.id ? fu.id : null;
      } catch (_) { /* follow-up creation is best-effort */ }
    }

    return Response.json({ ok: true, report_text: reportText, note_id: note && note.id, followup_id: followupId });
  } catch (error) {
    return Response.json({ error: error.message || 'generateCallReport failed' }, { status: 500 });
  }
});