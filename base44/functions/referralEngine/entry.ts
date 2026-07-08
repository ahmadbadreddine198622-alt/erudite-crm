import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// referralEngine — post-close referral cadence generator.
//
// Runs daily at 05:15 UTC via the platform scheduler, and supports manual
// invocation with { dry_run: true }. All DB ops via service role.
// NO silent error swallowing — every error surfaces in the response.
// Returns verified counts: { landlords_scanned, engines_started, followups_created, skipped_existing, errors }.
//
// For each Landlord with stage 'deal_closed' and an assigned_agent_email,
// who does NOT already have a Followup whose title starts with "Referral Engine":
//   Creates THREE pending Followups (created_from_ai=true):
//     a. day 0  — "Referral Engine — Wow thank-you (day 0)"        priority high
//     b. day +3 — "Referral Engine — Second sale conversation (day 3)" priority normal
//     c. day +7 — "Referral Engine — Referral ask (day 7)"         priority high
//
// Cap: max 5 engines started per agent per run. Scheduled times staggered
// across the working day (09–17 UTC).

const REFERRAL_TITLE_PREFIX = 'Referral Engine';
const AGENT_CAP = 5;
const BATCH_SIZE = 20;

function isoUtc(hoursOffsetDays, hourUtc) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + hoursOffsetDays);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

Deno.serve(async (req) => {
  const errors = [];
  let landlordsScanned = 0;
  let enginesStarted = 0;
  let followupsCreated = 0;
  let skippedExisting = 0;

  try {
    const base44 = createClientFromRequest(req);

    // If a user token is present (manual invocation), require admin.
    // No-token calls (platform-scheduled) are allowed — service role handles all writes.
    try {
      const callerUser = await base44.auth.me();
      if (callerUser && callerUser.role !== 'admin') {
        return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
      }
    } catch (_authErr) {
      // No user token — scheduled invocation, proceed with service role.
    }

    const svc = base44.asServiceRole;

    let body = {};
    if (req.method !== 'GET') {
      body = await req.json();
    }
    const dryRun = body.dry_run === true;

    // 1. Fetch all deal_closed landlords with an assigned agent.
    const allLandlords = await svc.entities.Landlord.list('-updated_date', 5000);
    const candidates = (allLandlords || []).filter(
      (l) => l && l.assigned_agent_email && l.stage === 'deal_closed'
    );
    landlordsScanned = candidates.length;

    // 2. Fetch all existing "Referral Engine" followups for dedup (any status).
    //    Filter by title prefix is not supported server-side, so we fetch a wide set
    //    and dedup in memory.
    const existingReferralFups = await svc.entities.Followup.list('-created_date', 5000);
    const dedupSet = new Set();
    for (const f of existingReferralFups) {
      if (f.landlord_id && (f.title || '').startsWith(REFERRAL_TITLE_PREFIX)) {
        dedupSet.add(f.landlord_id);
      }
    }

    // 3. Filter out landlords that already have a referral-engine followup.
    const eligible = candidates.filter((l) => !dedupSet.has(l.id));

    // Count skipped (landlords that already had a referral engine followup).
    skippedExisting = candidates.length - eligible.length;

    // 4. Per-agent cap: max 5 engines started per agent per run.
    const perAgentCount = {};

    // Process in batches to avoid timeouts.
    const createdDigest = [];

    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (ll) => {
          const agentKey = ll.assigned_agent_email.toLowerCase();
          if ((perAgentCount[agentKey] || 0) >= AGENT_CAP) {
            return { skipped: true };
          }
          perAgentCount[agentKey] = (perAgentCount[agentKey] || 0) + 1;
          enginesStarted++;

          // Stagger scheduled_at times across the working day (09–17 UTC),
          // cycling through hours so multiple agents' followups don't all land at once.
          const baseIdx = perAgentCount[agentKey] - 1; // 0-based
          const staggerHour = 9 + ((baseIdx * 2) % 8); // 9,11,13,15,17,9,11,...

          const slots = [
            isoUtc(0, staggerHour),      // day 0
            isoUtc(3, staggerHour),      // day +3
            isoUtc(7, staggerHour),      // day +7
          ];

          if (dryRun) {
            return {
              landlord_id: ll.id,
              agent_email: ll.assigned_agent_email,
              followups: [
                { title: 'Referral Engine — Wow thank-you (day 0)', scheduled_at: slots[0], priority: 'high' },
                { title: 'Referral Engine — Second sale conversation (day 3)', scheduled_at: slots[1], priority: 'normal' },
                { title: 'Referral Engine — Referral ask (day 7)', scheduled_at: slots[2], priority: 'high' },
              ],
            };
          }

          // Create the three followups.
          const f1 = await svc.entities.Followup.create({
            landlord_id: ll.id,
            title: 'Referral Engine — Wow thank-you (day 0)',
            notes: 'Send a personal thank-you and a clear what-happens-next after their closed deal. Building Expert tone, no ask.',
            scheduled_at: slots[0],
            status: 'pending',
            priority: 'high',
            kind: 'follow_up',
            agent_email: ll.assigned_agent_email,
            created_from_ai: true,
          });
          followupsCreated++;

          const f2 = await svc.entities.Followup.create({
            landlord_id: ll.id,
            title: 'Referral Engine — Second sale conversation (day 3)',
            notes: 'Open the next-investment / rental-management conversation. Their capital and trust are warmest right now.',
            scheduled_at: slots[1],
            status: 'pending',
            priority: 'normal',
            kind: 'follow_up',
            agent_email: ll.assigned_agent_email,
            created_from_ai: true,
          });
          followupsCreated++;

          const f3 = await svc.entities.Followup.create({
            landlord_id: ll.id,
            title: 'Referral Engine — Referral ask (day 7)',
            notes: 'Use the shared MessageTemplate "Referral Ask — Multiply Through Existing (post-deal)". Every closed owner knows two more owners. Log new referrals by setting referrer_landlord_id on the new record.',
            scheduled_at: slots[2],
            status: 'pending',
            priority: 'high',
            kind: 'follow_up',
            agent_email: ll.assigned_agent_email,
            created_from_ai: true,
          });
          followupsCreated++;

          return {
            landlord_id: ll.id,
            agent_email: ll.assigned_agent_email,
            followup_ids: [f1.id, f2.id, f3.id],
          };
        })
      );

      // Collect any rejected promises into errors — no swallowing.
      for (const r of results) {
        if (r.status === 'rejected') {
          errors.push(String(r.reason?.message || r.reason || 'Unknown error'));
        } else if (r.status === 'fulfilled' && r.value && !r.value.skipped) {
          createdDigest.push(r.value);
        }
      }
    }

    return Response.json({
      landlords_scanned: landlordsScanned,
      engines_started: enginesStarted,
      followups_created: followupsCreated,
      skipped_existing: skippedExisting,
      errors,
      ...(dryRun ? { engines: createdDigest } : {}),
    });
  } catch (error) {
    return Response.json({
      error: error.message,
      landlords_scanned: landlordsScanned,
      engines_started: enginesStarted,
      followups_created: followupsCreated,
      skipped_existing: skippedExisting,
      errors,
    }, { status: 500 });
  }
});