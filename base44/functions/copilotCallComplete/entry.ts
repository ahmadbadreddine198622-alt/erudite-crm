import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// copilotCallComplete — called by the CRM frontend when the relay server
// signals that a copilot-enabled call has ended. Saves the transcript,
// summary, and auto-filled qualification to the CRM.
//
// Authenticated via base44.auth.me() (CRM user session). The relay sends
// the call-complete payload over the cockpit WebSocket; the frontend invokes
// this function through the SDK.
//
// Input: { call_log_id, landlord_id, transcript, qualify_updates, signals, summary }
// Actions:
//   1. Save transcript + summary to CallLog
//   2. Create CallQualification pre-filled from qualify_updates (source=copilot, status=pending_confirmation)
//   3. Append summary to landlord's ai_rolling_summary
//   4. Store signals on landlord record (buying_signals)

const ALLOWED_QUALIFY_FIELDS = [
  'motivation','motivation_notes','timeline_urgency','price_expectation_aed',
  'price_vs_valuation','mandate_openness','competing_brokers','tenancy_status',
  'available_from','mortgage_status','is_decision_maker','call_outcome',
  'rapport_after_call','next_step','followup_date',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const { call_log_id, landlord_id, transcript, qualify_updates, signals, summary } = body;

    if (!call_log_id) return Response.json({ error: 'call_log_id is required' }, { status: 400 });
    if (!landlord_id) return Response.json({ error: 'landlord_id is required' }, { status: 400 });

    const sr = base44.asServiceRole;

    // 1. Save transcript + summary to CallLog (skip gracefully if not found)
    const callLogUpdate = {};
    if (transcript) callLogUpdate.transcript = transcript;
    if (summary) callLogUpdate.summary = summary;
    if (signals) callLogUpdate.copilot_signals = signals;
    if (Object.keys(callLogUpdate).length > 0) {
      try {
        await sr.entities.CallLog.update(call_log_id, callLogUpdate);
        console.log(`[copilotCallComplete] ✅ CallLog ${call_log_id} updated with transcript (${transcript?.length || 0} chars) + summary`);
      } catch (clErr) {
        console.warn(`[copilotCallComplete] CallLog ${call_log_id} update skipped: ${clErr?.message}`);
      }
    }

    // 2. Create CallQualification pre-filled from qualify_updates
    if (qualify_updates && typeof qualify_updates === 'object' && Object.keys(qualify_updates).length > 0) {
      const payload = {
        landlord_id,
        landlord_name: '',
        agent_email: user.email,
        call_date: new Date().toISOString(),
        call_channel: 'phone',
        source: 'copilot',
        status: 'pending_confirmation',
        ai_processed: false,
      };

      // Look up landlord name
      try {
        const L = await sr.entities.Landlord.get(landlord_id);
        if (L) payload.landlord_name = L.full_name_en || L.full_name || '';
      } catch (_) {}

      for (const key of ALLOWED_QUALIFY_FIELDS) {
        if (qualify_updates[key] !== undefined && qualify_updates[key] !== null && qualify_updates[key] !== '') {
          payload[key] = qualify_updates[key];
        }
      }

      try {
        await sr.entities.CallQualification.create(payload);
        console.log(`[copilotCallComplete] ✅ CallQualification created (source=copilot, status=pending_confirmation)`);
      } catch (cqErr) {
        console.error(`[copilotCallComplete] CallQualification create failed:`, cqErr?.message);
      }
    }

    // 3. Append summary to landlord's ai_rolling_summary
    if (summary) {
      try {
        const L = await sr.entities.Landlord.get(landlord_id);
        if (L) {
          const existing = L.ai_rolling_summary || '';
          const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          const newSummary = existing
            ? `${existing}\n\n[${stamp} — Copilot call] ${summary}`
            : `[${stamp} — Copilot call] ${summary}`;
          await sr.entities.Landlord.update(landlord_id, { ai_rolling_summary: newSummary });
          console.log(`[copilotCallComplete] ✅ Landlord rolling summary updated`);
        }
      } catch (lErr) {
        console.error(`[copilotCallComplete] Landlord summary update failed:`, lErr?.message);
      }
    }

    // 4. Store signals on landlord record (merge into buying_signals)
    if (signals && Array.isArray(signals.detected_flags) && signals.detected_flags.length > 0) {
      try {
        const L = await sr.entities.Landlord.get(landlord_id);
        if (L) {
          const existing = Array.isArray(L.buying_signals) ? L.buying_signals : [];
          const merged = [...new Set([...existing, ...signals.detected_flags])];
          await sr.entities.Landlord.update(landlord_id, { buying_signals: merged });
          console.log(`[copilotCallComplete] ✅ Landlord buying_signals updated: +${signals.detected_flags.length}`);
        }
      } catch (sErr) {
        console.error(`[copilotCallComplete] Landlord signals update failed:`, sErr?.message);
      }
    }

    return Response.json({ ok: true, saved: true });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});