import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// copilotCallComplete — called by the relay server when a copilot-enabled call
// ends. Authenticated by api_key header (validated against SyncState 'copilot_api_key').
//
// Input: { call_log_id, landlord_id, transcript, qualify_updates, signals, summary }
// Actions:
//   1. Save transcript + summary to the CallLog
//   2. Create or update a CallQualification (source=copilot, status=pending_confirmation)
//   3. Append summary to the landlord's ai_rolling_summary
//   4. Store signals on the landlord record (buying_signals)

async function validateApiKey(base44, req) {
  const apiKey = req.headers.get('api_key') || req.headers.get('x-api-key') || '';
  if (!apiKey) return false;
  const existing = await base44.asServiceRole.entities.SyncState.filter({ key: 'copilot_api_key' });
  if (!existing || existing.length === 0) {
    await base44.asServiceRole.entities.SyncState.create({ key: 'copilot_api_key', value: apiKey });
    return true;
  }
  return existing[0].value === apiKey;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Also accept user auth (app frontend can call this directly)
    let isAuthed = false;
    try {
      const user = await base44.auth.me();
      if (user) isAuthed = true;
    } catch (_) {}
    if (!isAuthed) {
      isAuthed = await validateApiKey(base44, req);
    }
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { call_log_id, landlord_id, transcript, qualify_updates, signals, summary } = body;

    if (!call_log_id && !landlord_id) {
      return Response.json({ error: 'call_log_id or landlord_id required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;

    // 1. Save transcript + summary to CallLog
    if (call_log_id) {
      try {
        await sr.entities.CallLog.update(call_log_id, {
          transcript: transcript || '',
          summary: summary || '',
          status: 'completed',
          ended_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[copilotCallComplete] CallLog update failed:', e.message);
      }
    }

    // 2. Create CallQualification (source=copilot, status=pending_confirmation)
    let qualId = null;
    if (landlord_id && qualify_updates && Object.keys(qualify_updates).length > 0) {
      try {
        // Check if one already exists for this call_log_id
        let existing = [];
        if (call_log_id) {
          existing = await sr.entities.CallQualification.filter({ call_log_id });
        }

        // Get landlord name + agent email from the landlord record or call log
        let agentEmail = '';
        let landlordName = '';
        let landlord = null;
        try {
          landlord = await sr.entities.Landlord.get(landlord_id);
          landlordName = landlord?.full_name_en || landlord?.full_name || '';
          agentEmail = landlord?.assigned_agent_email || '';
        } catch (_) {}
        if (!agentEmail && call_log_id) {
          try {
            const logs = await sr.entities.CallLog.filter({ id: call_log_id });
            if (logs?.[0]) agentEmail = logs[0].agent_email || '';
          } catch (_) {}
        }

        const payload = {
          landlord_id,
          landlord_name: landlordName,
          agent_email: agentEmail || 'copilot@erudite-estate.com',
          call_date: new Date().toISOString(),
          call_channel: 'phone',
          source: 'copilot',
          status: 'pending_confirmation',
          call_log_id: call_log_id || null,
          ai_processed: false,
        };

        // Map qualify_updates to CallQualification fields
        const allowedFields = [
          'motivation','motivation_notes','timeline_urgency','price_expectation_aed',
          'price_vs_valuation','mandate_openness','competing_brokers','tenancy_status',
          'available_from','mortgage_status','is_decision_maker','call_outcome',
          'rapport_after_call','next_step','followup_date','agent_notes'
        ];
        for (const k of allowedFields) {
          if (qualify_updates[k] !== undefined && qualify_updates[k] !== null && qualify_updates[k] !== '') {
            payload[k] = qualify_updates[k];
          }
        }

        if (existing && existing.length > 0) {
          await sr.entities.CallQualification.update(existing[0].id, payload);
          qualId = existing[0].id;
        } else {
          const created = await sr.entities.CallQualification.create(payload);
          qualId = created.id;
        }
      } catch (e) {
        console.warn('[copilotCallComplete] CallQualification create failed:', e.message);
      }
    }

    // 3. Append summary to landlord's ai_rolling_summary
    if (landlord_id && summary) {
      try {
        const landlord = await sr.entities.Landlord.get(landlord_id);
        if (landlord) {
          const existingSummary = landlord.ai_rolling_summary || '';
          const stamp = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          const newSummary = existingSummary
            ? `${existingSummary}\n\n[Call · ${stamp}]\n${summary}`
            : `[Call · ${stamp}]\n${summary}`;
          // Keep rolling summary bounded (last ~2000 chars)
          const trimmed = newSummary.length > 2000 ? newSummary.slice(-2000) : newSummary;
          await sr.entities.Landlord.update(landlord_id, { ai_rolling_summary: trimmed });
        }
      } catch (e) {
        console.warn('[copilotCallComplete] rolling summary update failed:', e.message);
      }
    }

    // 4. Store signals on the landlord record (merge into buying_signals)
    if (landlord_id && Array.isArray(signals) && signals.length > 0) {
      try {
        const landlord = await sr.entities.Landlord.get(landlord_id);
        if (landlord) {
          const existing = Array.isArray(landlord.buying_signals) ? landlord.buying_signals : [];
          const merged = Array.from(new Set([...existing, ...signals]));
          await sr.entities.Landlord.update(landlord_id, { buying_signals: merged });
        }
      } catch (e) {
        console.warn('[copilotCallComplete] signals update failed:', e.message);
      }
    }

    return Response.json({
      ok: true,
      call_log_id: call_log_id || null,
      qualification_id: qualId,
      landlord_id: landlord_id || null,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});