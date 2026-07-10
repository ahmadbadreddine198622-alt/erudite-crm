import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// wowMilestones — milestone wow-moment Followup generator.
//
// Runs daily at 05:30 UTC via the platform scheduler, and supports manual
// invocation with { dry_run: true }. All DB ops via service role.
// NO silent error swallowing — no .catch(() => ...) anywhere; errors surface
// in the response. Returns verified counts:
//   { landlords_scanned, milestones_triggered, followups_created, skipped_existing, errors }
//
// For each Landlord with an assigned_agent_email whose stage_entered_at is
// within the last 3 days and whose stage is one of the wow milestones below,
// creates Followup records (created_from_ai=true) for the landlord's agent.
// It NEVER sends messages to landlords itself — human-in-the-loop only.
//
// Milestone rules:
//   a. stage = form_a_signing → same day, priority high —
//        "Wow — Form A signed: what happens next"
//   b. stage = listing_publication → same day, priority high —
//        "Wow — Listing is live"
//        PLUS +7 days, priority normal —
//        "Wow — First-week performance report"
//
// Dedup marker: skip if a Followup (any status) already exists for that landlord
// whose title starts with "Wow — " and mentions that stage.
//
// Cap: 10 milestone engines per run per agent, stagger scheduled_at across
// the working day (09–17 UTC).

const WOW_PREFIX = 'Wow — ';
const AGENT_CAP = 10;
const BATCH_SIZE = 20;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// stage → list of followup templates to create
const MILESTONES = {
  form_a_signing: [
    {
      title: 'Wow — Form A signed: what happens next',
      offsetDays: 0,
      priority: 'high',
      notes:
        'Send a personal thank-you plus a clear step-by-step of what Erudite does next ' +
        '(photos, listing build, marketing) with expected timeline. Building Expert tone, zero ask. ' +
        'This is the moment that decides how the exclusive feels.',
      stageTag: 'form_a_signing',
    },
  ],
  listing_publication: [
    {
      title: 'Wow — Listing is live',
      offsetDays: 0,
      priority: 'high',
      notes:
        'Send the landlord their live listing link with one line of pride and what to expect in week one.',
      stageTag: 'listing_publication',
    },
    {
      title: 'Wow — First-week performance report',
      offsetDays: 7,
      priority: 'normal',
      notes:
        'Share real week-one numbers (views, leads, saved counts) from the Property Finder listing data ' +
        'and what we are adjusting. Landlords renew exclusives for brokers who report without being asked.',
      stageTag: 'listing_publication',
    },
  ],
};

const MILESTONE_STAGES = new Set(Object.keys(MILESTONES));

function isoUtcDaysFromToday(daysOffset, hourUtc) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

// Stagger scheduled_at hours across 09–17 UTC.
function staggerHour(engineIdx) {
  return 9 + ((engineIdx * 2) % 8); // 9,11,13,15,17,9,11,...
}

Deno.serve(async (req) => {
  const errors = [];
  let landlordsScanned = 0;
  let milestonesTriggered = 0;
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

    const now = Date.now();
    const cutoff = now - THREE_DAYS_MS;

    // 1. Fetch all landlords with an assigned agent, filter to milestone stages
    //    whose stage_entered_at is within the last 3 days.
    const allLandlords = await svc.entities.Landlord.list('-updated_date', 5000);
    const candidates = (allLandlords || []).filter((l) => {
      if (!l || !l.assigned_agent_email) return false;
      if (!MILESTONE_STAGES.has(l.stage)) return false;
      // stage_entered_at must be within the last 3 days.
      const enteredTs = l.stage_entered_at ? new Date(l.stage_entered_at).getTime() : 0;
      if (isNaN(enteredTs) || enteredTs === 0) return false;
      return enteredTs >= cutoff && enteredTs <= now;
    });
    landlordsScanned = candidates.length;

    // 2. Fetch all existing "Wow — " followups for dedup (any status).
    //    Build a map: landlord_id → Set of stageTags already commemorated.
    //    A Followup qualifies as a dedup marker if its title starts with "Wow — "
    //    and mentions that stage.
    const existingFups = await svc.entities.Followup.list('-created_date', 5000);
    const dedupMap = new Map(); // landlord_id → Set<stageTag>
    for (const f of existingFups) {
      if (!f.landlord_id || !f.title) continue;
      if (!f.title.startsWith(WOW_PREFIX)) continue;
      // Check which stage(s) this title commemorates.
      const lowerTitle = f.title.toLowerCase();
      for (const stage of MILESTONE_STAGES) {
        if (lowerTitle.includes(stage.toLowerCase().replace(/_/g, ' ')) || lowerTitle.includes(stage.toLowerCase())) {
          let set = dedupMap.get(f.landlord_id);
          if (!set) { set = new Set(); dedupMap.set(f.landlord_id, set); }
          set.add(stage);
        }
        // Also match human-readable phrases for stages.
        if (stage === 'form_a_signing' && (lowerTitle.includes('form a signed') || lowerTitle.includes('form a'))) {
          let set = dedupMap.get(f.landlord_id);
          if (!set) { set = new Set(); dedupMap.set(f.landlord_id, set); }
          set.add(stage);
        }
        if (stage === 'listing_publication' && (lowerTitle.includes('listing is live') || lowerTitle.includes('first-week'))) {
          let set = dedupMap.get(f.landlord_id);
          if (!set) { set = new Set(); dedupMap.set(f.landlord_id, set); }
          set.add(stage);
        }
      }
    }

    // 3. Per-agent cap: max 10 milestone engines per agent per run.
    const perAgentCount = {};
    const createdDigest = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (ll) => {
          const agentKey = ll.assigned_agent_email.toLowerCase();
          if ((perAgentCount[agentKey] || 0) >= AGENT_CAP) {
            return { skipped: true };
          }

          const templates = MILESTONES[ll.stage];
          // Filter out templates whose stage is already commemorated for this landlord.
          const existingTags = dedupMap.get(ll.id);
          const freshTemplates = templates.filter(
            (t) => !existingTags || !existingTags.has(t.stageTag)
          );

          if (freshTemplates.length === 0) {
            return { deduped: true };
          }

          perAgentCount[agentKey] = (perAgentCount[agentKey] || 0) + 1;
          milestonesTriggered++;

          const engineIdx = perAgentCount[agentKey] - 1; // 0-based
          const baseHour = staggerHour(engineIdx);

          const followupSpecs = freshTemplates.map((t, idx) => ({
            landlord_id: ll.id,
            title: t.title,
            notes: t.notes,
            scheduled_at: isoUtcDaysFromToday(t.offsetDays, (baseHour + idx * 2) % 24),
            status: 'pending',
            priority: t.priority,
            kind: 'follow_up',
            agent_email: ll.assigned_agent_email,
            created_from_ai: true,
          }));

          if (dryRun) {
            return {
              landlord_id: ll.id,
              agent_email: ll.assigned_agent_email,
              stage: ll.stage,
              stage_entered_at: ll.stage_entered_at,
              followups: followupSpecs.map((f) => ({
                title: f.title,
                scheduled_at: f.scheduled_at,
                priority: f.priority,
              })),
            };
          }

          // Create the followups sequentially — no .catch swallowing.
          const createdIds = [];
          for (const spec of followupSpecs) {
            const f = await svc.entities.Followup.create(spec);
            createdIds.push(f.id);
            followupsCreated++;
          }

          return {
            landlord_id: ll.id,
            agent_email: ll.assigned_agent_email,
            stage: ll.stage,
            followup_ids: createdIds,
          };
        })
      );

      // Collect any rejected promises into errors — no swallowing.
      for (const r of results) {
        if (r.status === 'rejected') {
          const reason = r.reason;
          errors.push(String(reason?.message || reason || 'Unknown error'));
        } else if (r.status === 'fulfilled' && r.value) {
          if (r.value.deduped) {
            skippedExisting++;
          } else if (!r.value.skipped) {
            createdDigest.push(r.value);
          }
        }
      }
    }

    return Response.json({
      landlords_scanned: landlordsScanned,
      milestones_triggered: milestonesTriggered,
      followups_created: followupsCreated,
      skipped_existing: skippedExisting,
      errors,
      ...(dryRun ? { milestones: createdDigest } : {}),
    });
  } catch (error) {
    return Response.json({
      error: error.message,
      landlords_scanned: landlordsScanned,
      milestones_triggered: milestonesTriggered,
      followups_created: followupsCreated,
      skipped_existing: skippedExisting,
      errors,
    }, { status: 500 });
  }
});