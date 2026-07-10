import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * copilotCallComplete — called by the Call Copilot relay when a call ends.
 * Auth: header `api_key` must match env COPILOT_API_KEY.
 * Body: { call_log_id, landlord_id, agent_email, transcript[], qualify_updates[],
 *         signals[], talk_ratio, summary, started_at, ended_at }
 *
 * Actions:
 *  1. Save diarized transcript + summary + copilot metadata to the CallLog
 *     (creates the log if the relay never got a real id).
 *  2. Create a CallQualification pre-filled from qualify_updates with
 *     source="copilot", confirmation_status="pending_confirmation".
 *  3. Append the summary to the landlord's ai_rolling_summary.
 *  4. Merge detected signals into the landlord's buying_signals.
 */

const ENUM_FIELDS = {
  motivation: ['relocating','cashing_out','upgrading_downsizing','distressed_need_funds','inherited','poor_returns','just_testing_market','other','unknown'],
  timeline_urgency: ['asap_urgent','1_3_months','3_6_months','6_12_months','no_rush_testing','unknown'],
  price_vs_valuation: ['realistic','slightly_high','significantly_overpriced','below_market','not_discussed'],
  mandate_openness: ['open_to_exclusive','non_exclusive_only','already_with_other_brokers','wants_to_self_sell','undecided','not_discussed'],
  tenancy_status: ['vacant','tenanted_lease_active','tenanted_lease_expiring','owner_occupied','unknown'],
  mortgage_status: ['free_and_clear','mortgaged_local','mortgaged_overseas','payment_plan','unknown'],
  is_decision_maker: ['sole_decision_maker','joint_needs_spouse','represents_owner','unknown'],
  call_outcome: ['interested_proceeding','needs_followup','callback_requested','thinking_about_it','not_ready','not_interested','no_answer','wrong_number','dead_lead'],
  rapport_after_call: ['cold','warming','rapport_built','trust_established','champion'],
};
const TEXT_FIELDS = ['competing_brokers', 'next_step', 'motivation_notes', 'agent_notes'];
const DATE_FIELDS = ['available_from', 'followup_date'];

function transcriptToText(transcript) {
  if (!Array.isArray(transcript)) return typeof transcript === 'string' ? transcript : '';
  return transcript
    .map(t => `[${t.speaker === 'agent' ? 'AGENT' : 'LANDLORD'}] ${t.text}`)
    .join('\n');
}

Deno.serve(async (req) => {
  try {
    const expected = Deno.env.get('COPILOT_API_KEY') || '';
    const got = req.headers.get('api_key') || '';
    if (!expected || got !== expected) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const {
      call_log_id, landlord_id, agent_email,
      transcript, qualify_updates, signals, talk_ratio, summary,
      started_at, ended_at,
    } = body;

    const result = { ok: true };
    const transcriptText = transcriptToText(transcript);
    const cleanSignals = Array.isArray(signals) ? signals.filter(s => typeof s === 'string' && s).slice(0, 30) : [];

    // ── 1. CallLog ────────────────────────────────────────────────────────
    let logId = call_log_id && !String(call_log_id).startsWith('unknown-') ? call_log_id : null;
    const logUpdate = {
      copilot_used: true,
      status: 'completed',
    };
    if (transcriptText) logUpdate.transcript = transcriptText;
    if (summary) logUpdate.summary = summary;
    if (cleanSignals.length) logUpdate.copilot_signals = cleanSignals;
    if (talk_ratio?.agent_pct != null) logUpdate.talk_ratio_agent_pct = talk_ratio.agent_pct;
    if (ended_at) logUpdate.ended_at = ended_at;

    if (logId) {
      try {
        await sr.entities.CallLog.update(logId, logUpdate);
      } catch (e) {
        console.warn('[copilotCallComplete] CallLog.update failed, will create:', e?.message);
        logId = null;
      }
    }
    if (!logId) {
      const created = await sr.entities.CallLog.create({
        landlord_id: landlord_id || null,
        direction: 'outbound',
        to_number: 'copilot-call',
        agent_email: agent_email || '',
        started_at: started_at || new Date().toISOString(),
        ...logUpdate,
      });
      logId = created.id;
    }
    result.call_log_id = logId;

    // ── 2. CallQualification (pending confirmation) ───────────────────────
    if (landlord_id && Array.isArray(qualify_updates) && qualify_updates.length) {
      // last value per field wins
      const merged = {};
      const quotes = [];
      for (const u of qualify_updates) {
        if (!u?.field_key) continue;
        merged[u.field_key] = u.value;
        if (u.quote) quotes.push(`${u.field_key}: "${u.quote}"`);
      }

      const qual = {
        landlord_id,
        agent_email: agent_email || 'copilot@erudite-estate.com',
        call_date: started_at || new Date().toISOString(),
        call_channel: 'phone',
        source: 'copilot',
        confirmation_status: 'pending_confirmation',
        call_log_id: logId,
        ai_processed: false,
      };

      let fieldCount = 0;
      for (const [k, allowed] of Object.entries(ENUM_FIELDS)) {
        const v = merged[k];
        if (v && allowed.includes(String(v))) { qual[k] = String(v); fieldCount++; }
      }
      for (const k of TEXT_FIELDS) {
        if (merged[k] && typeof merged[k] === 'string') { qual[k] = merged[k].slice(0, 800); fieldCount++; }
      }
      for (const k of DATE_FIELDS) {
        const v = merged[k];
        if (v && /^\d{4}-\d{2}-\d{2}/.test(String(v))) { qual[k] = String(v).slice(0, 10); fieldCount++; }
      }
      const price = Number(merged.price_expectation_aed);
      if (!isNaN(price) && price > 0) { qual.price_expectation_aed = price; fieldCount++; }

      // Landlord's own words → motivation_notes (don't clobber an explicit one)
      if (!qual.motivation_notes && quotes.length) {
        qual.motivation_notes = quotes.join(' | ').slice(0, 800);
      }

      try {
        const l = (await sr.entities.Landlord.filter({ id: landlord_id }))?.[0];
        if (l) qual.landlord_name = l.full_name_en || `${l.first_name || ''} ${l.last_name || ''}`.trim();
      } catch (_) { /* name is cosmetic */ }

      if (fieldCount > 0) {
        const createdQual = await sr.entities.CallQualification.create(qual);
        result.qualification_id = createdQual.id;
        result.qualification_fields = fieldCount;
      }
    }

    // ── 3 + 4. Landlord rolling summary + signals ─────────────────────────
    if (landlord_id) {
      try {
        const landlords = await sr.entities.Landlord.filter({ id: landlord_id });
        const L = landlords?.[0];
        if (L) {
          const update = {};
          if (summary) {
            const stamp = new Date().toISOString().slice(0, 10);
            const entry = `\n\n[${stamp} · copilot call] ${summary}`;
            const combined = ((L.ai_rolling_summary || '') + entry);
            // keep the tail — most recent context matters most
            update.ai_rolling_summary = combined.length > 6000 ? combined.slice(-6000) : combined;
          }
          if (cleanSignals.length) {
            const existing = Array.isArray(L.buying_signals) ? L.buying_signals : [];
            update.buying_signals = [...new Set([...existing, ...cleanSignals])].slice(0, 40);
          }
          if (Object.keys(update).length) {
            await sr.entities.Landlord.update(landlord_id, update);
            result.landlord_updated = true;
          }
        }
      } catch (e) {
        console.warn('[copilotCallComplete] landlord update failed:', e?.message);
        result.landlord_updated = false;
      }
    }

    console.log(`[copilotCallComplete] done call=${logId} landlord=${landlord_id} qual_fields=${result.qualification_fields || 0} signals=${cleanSignals.length}`);
    return Response.json(result);
  } catch (err) {
    console.error('[copilotCallComplete] error:', err?.message);
    return Response.json({ error: err?.message || 'internal error' }, { status: 500 });
  }
});
