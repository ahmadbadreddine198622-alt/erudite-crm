import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// enforceFourteenDayLaw — THE LAW: no active landlord may sit silent past 14 days
// with no scheduled next touch.
//
// Runs daily (wire a Base44 schedule at ~05:00 UTC) and supports manual invocation.
// All DB ops via service role. Batched + time-bounded + per-agent capped so a single
// run can never flood an agent's morning or blow the Deno deploy time ceiling.
//
// For each active Landlord (stage not deal_closed) with an assigned_agent_email:
//   1. Last outbound contact = max timestamp across Message(outgoing), IMessage(outbound),
//      TelegramMessage(outbound), Email(outbound).
//   2. Next touch exists = any pending Followup scheduled in the future, OR any future
//      LandlordAppointment(status=scheduled).
//   3. If silent >14d (or never contacted) AND no next touch AND no existing pending
//      "14-Day Law" followup → create ONE Followup, staggered across the next 5 working
//      days, max 10 new followups per agent per run.
//
// Body: { dry_run?=false, batch_size?=15, max_landlords?=500 }

const CEILING_MS = 170000;
const STOP_AT_MS = CEILING_MS - 30000;
const TERMINAL_STAGES = ['deal_closed'];
const LAW_TITLE = '14-Day Law — schedule next touch';
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const PER_AGENT_CAP = 10;

// Early stages → rule5_* cadence; later stages → law14_nurture.
const EARLY_STAGES = new Set([
  'initial_contact', 'attempted_to_contact', 'price_discovery', 'listing_commitment'
]);

// Returns `count` ISO datetimes (UTC) spread across the next `count` working days,
// one per day, starting tomorrow, skipping Sat/Sun. Hours cycle 9→10→11 UTC.
function nextWorkdaySlots(count) {
  const out = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  let hour = 9;
  while (out.length < count) {
    const day = d.getUTCDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) {
      const slot = new Date(d);
      slot.setUTCHours(hour, 0, 0, 0);
      out.push(slot.toISOString());
      hour = hour === 9 ? 10 : hour === 10 ? 11 : 9;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function cadenceStep(stage, listedWithOthers) {
  if (listedWithOthers) return 'unsold_competitor_watch_30';
  if (EARLY_STAGES.has(stage)) return 'rule5_day2_value_drop / rule5_day5_call / rule5_day9_voice_note / rule5_day14_snapshot';
  return 'law14_nurture';
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    // If a user token is present (manual invocation), require admin. No-token calls
    // (platform-scheduled) are allowed — service role handles all writes either way.
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
      }
    } catch (_) { /* no user token — scheduled invocation */ }

    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const dryRun = body.dry_run === true;
    const batchSize = (typeof body.batch_size === 'number' && body.batch_size > 0) ? Math.floor(body.batch_size) : 15;
    const maxLandlords = (typeof body.max_landlords === 'number' && body.max_landlords > 0) ? Math.floor(body.max_landlords) : 500;

    // 1. Active landlords with an assigned agent, not deal_closed.
    const all = await svc.entities.Landlord.list('-updated_date', 5000);
    const candidates = (all || []).filter((l) =>
      l && l.assigned_agent_email && !TERMINAL_STAGES.includes(l.stage)
    ).slice(0, maxLandlords);

    const slots = nextWorkdaySlots(5);
    const perAgentCount = {};

    let landlordsChecked = 0;
    let violationsFound = 0;
    let followupsCreated = 0;
    let skippedExisting = 0;

    for (let i = 0; i < candidates.length; i += batchSize) {
      if (Date.now() - startedAt > STOP_AT_MS) break;
      const batch = candidates.slice(i, i + batchSize);

      await Promise.allSettled(batch.map(async (ll) => {
        landlordsChecked++;
        const lid = ll.id;
        const now = Date.now();

        // 3. Dedup + next-touch check in a single pending-followup fetch.
        const pendingFups = await svc.entities.Followup.filter(
          { landlord_id: lid, status: 'pending' }, '-created_date', 50
        );

        const hasLawPending = (pendingFups || []).some((f) => f && f.title === LAW_TITLE);
        if (hasLawPending) { skippedExisting++; return; }

        const hasScheduledFup = (pendingFups || []).some(
          (f) => f && f.scheduled_at && new Date(f.scheduled_at).getTime() > now
        );

        // 1b. Future appointment?
        const futureAppts = await svc.entities.LandlordAppointment.filter(
          { landlord_id: lid, status: 'scheduled' }, '-datetime', 50
        );
        const hasFutureAppt = (futureAppts || []).some(
          (a) => a && a.datetime && new Date(a.datetime).getTime() > now
        );

        if (hasScheduledFup || hasFutureAppt) return; // a next touch already exists

        // 1a. Last outbound contact across the 4 channels.
        const [msgs, ims, tgs, ems] = await Promise.all([
          svc.entities.Message.filter({ landlord_id: lid, direction: 'outgoing' }, '-timestamp', 1),
          svc.entities.IMessage.filter({ landlord_id: lid, direction: 'outbound' }, '-sent_at', 1),
          svc.entities.TelegramMessage.filter({ landlord_id: lid, direction: 'outbound' }, '-sent_at', 1),
          svc.entities.Email.filter({ landlord_id: lid, direction: 'outbound' }, '-received_at', 1),
        ]);

        let lastTs = 0;
        const consider = (arr, field) => {
          if (Array.isArray(arr) && arr.length > 0 && arr[0] && arr[0][field]) {
            const t = new Date(arr[0][field]).getTime();
            if (!isNaN(t) && t > lastTs) lastTs = t;
          }
        };
        consider(msgs, 'timestamp');
        consider(ims, 'sent_at');
        consider(tgs, 'sent_at');
        consider(ems, 'received_at');

        // Silent = no outbound in >14d (lastTs=0 → never contacted → also a violation).
        if (lastTs > 0 && (now - lastTs) <= FOURTEEN_DAYS_MS) return;

        violationsFound++;

        // Per-agent cap so one agent isn't flooded.
        const agent = ll.assigned_agent_email;
        if ((perAgentCount[agent] || 0) >= PER_AGENT_CAP) return;

        if (dryRun) return;

        const slotIdx = followupsCreated % slots.length;
        const scheduledAt = slots[slotIdx];
        const step = cadenceStep(ll.stage, ll.is_currently_listed_with_others === true);
        const lastLabel = lastTs > 0 ? new Date(lastTs).toISOString() : 'never';
        const notes =
          `14-Day Law violation: last outbound contact was ${lastLabel}. ` +
          `No pending follow-up or upcoming appointment on record. ` +
          `Recommended cadence step: ${step}. ` +
          `Landlord stage: ${ll.stage}${ll.is_currently_listed_with_others ? ' (listed with competitors)' : ''}.`;

        await svc.entities.Followup.create({
          landlord_id: lid,
          title: LAW_TITLE,
          notes,
          scheduled_at: scheduledAt,
          status: 'pending',
          kind: 'follow_up',
          priority: ll.ai_strike_now === true ? 'high' : 'normal',
          agent_email: agent,
          created_from_ai: true,
        });

        perAgentCount[agent] = (perAgentCount[agent] || 0) + 1;
        followupsCreated++;
      }));
    }

    const summary = {
      landlords_checked: landlordsChecked,
      violations_found: violationsFound,
      followups_created: followupsCreated,
      skipped_existing: skippedExisting,
      dry_run: dryRun,
      elapsed_ms: Date.now() - startedAt,
    };
    console.log('[enforceFourteenDayLaw] summary:', JSON.stringify(summary));
    return Response.json(summary);
  } catch (error) {
    console.error('[enforceFourteenDayLaw] error:', error);
    return Response.json({ error: (error && error.message) ? error.message : String(error) }, { status: 500 });
  }
});