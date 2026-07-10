import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * mentorSweep — THE 17 / Erudite Academy proactive daemon (Phase 4).
 *
 * Nightly at 02:45 UTC via the Base44 platform scheduler (clear of the
 * 03:30–05:45 daemon fleet). INERT until a schedule is wired to it.
 *
 * Per active TrainingEnrollment, detects triggers in priority order:
 *   1. deal_silent_7d     — an active landlord file untouched >= 7 days
 *   2. streak_broken      — affirmation missed after a >= 5-day streak
 *   3. call_volume_drop   — last-7d calls > 40% below the 4-week weekly baseline
 *   4. reflection_missing — Friday and no TrainingReflection for current week
 * Fires at most ONE proactive_directive per agent per day through
 * mentorOrchestrator (svc.functions.invoke — same pattern as landlordHeartbeat).
 *
 * Fridays (UTC): additionally fires an Opus weekly_review per agent and writes
 * a PrincipleScoreSnapshot. NOTE: the live snapshot schema is {user_email,
 * agent_name, week_number, score, snapshot_date} — no components field exists,
 * so the component breakdown (reflection 0-35, behavior-vs-baseline 0-35,
 * streak 0-30) is computed here, summed into `score`, and returned in the run
 * report only.
 *
 * POST body: { dry_run?: true } — detects and reports, invokes nothing,
 * writes nothing.
 */

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const daysAgo = (d) => { const x = new Date(d); return isNaN(x) ? null : Math.floor((Date.now() - x.getTime()) / 86400000); };
const todayIso = () => new Date().toISOString().slice(0, 10);

async function detectTriggers(svc, enrollment) {
  const email = enrollment.user_email;
  const out = { trigger: null, detail: null, components: { reflection: 0, behavior: 0, streak: 0 }, week: enrollment.current_week || 1 };

  // signals
  let silent = [];
  try {
    const landlords = await svc.entities.Landlord.filter({ assigned_agent_email: email });
    silent = landlords
      .filter((l) => l.stage && l.stage !== 'deal_closed')
      .map((l) => ({ name: l.full_name_en || l.first_name || l.unit_reference || 'a landlord', project: l.project_name || '', days: daysAgo(l.updated_date) }))
      .filter((x) => x.days != null && x.days >= 7)
      .sort((a, b) => b.days - a.days);
  } catch (_) { /* optional */ }

  let streak = 0, lastLogDays = null;
  try {
    const logs = await svc.entities.DailyAffirmationLog.filter({ user_email: email }, '-log_date', 1);
    if (logs[0]) { streak = logs[0].current_streak || 0; lastLogDays = daysAgo(logs[0].log_date); }
  } catch (_) { /* optional */ }

  let calls7 = 0, baseline = null;
  try {
    const calls = await svc.entities.CallLog.filter({ agent_email: email }, '-started_at', 300);
    const ages = calls.map((c) => daysAgo(c.started_at)).filter((d) => d != null);
    calls7 = ages.filter((d) => d < 7).length;
    const d28 = ages.filter((d) => d < 28).length;
    baseline = d28 > calls7 ? (d28 - calls7) / 3 : null;
  } catch (_) { /* optional */ }

  let reflectionDone = false;
  try {
    const refl = await svc.entities.TrainingReflection.filter({ user_email: email, week_number: out.week });
    reflectionDone = refl.length > 0;
  } catch (_) { /* optional */ }

  // score components (used Fridays)
  out.components.reflection = reflectionDone ? 35 : 0;
  out.components.behavior = baseline && baseline >= 1 ? Math.round(35 * Math.min(1, calls7 / baseline)) : (calls7 > 0 ? 18 : 0);
  out.components.streak = Math.round(30 * Math.min(1, streak / 7));

  // trigger priority
  const isFriday = new Date().getUTCDay() === 5;
  if (silent.length) {
    out.trigger = 'deal_silent_7d';
    const s = silent[0];
    out.detail = `${s.name}${s.project ? ` (${s.project})` : ''} has been silent ${s.days} days${silent.length > 1 ? `; ${silent.length - 1} more file(s) also silent 7+` : ''}.`;
  } else if (streak >= 5 && lastLogDays != null && lastLogDays >= 2) {
    out.trigger = 'streak_broken';
    out.detail = `Affirmation streak of ${streak} broken — no log for ${lastLogDays} days.`;
  } else if (baseline != null && baseline >= 5 && calls7 < 0.6 * baseline) {
    out.trigger = 'call_volume_drop';
    out.detail = `Calls last 7 days: ${calls7}, vs weekly baseline ~${Math.round(baseline)} — a drop of more than 40%.`;
  } else if (isFriday && !reflectionDone) {
    out.trigger = 'reflection_missing';
    out.detail = `Week ${out.week} reflection not submitted and the week closes today.`;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const isFriday = new Date().getUTCDay() === 5;
    const today = todayIso();

    const enrollments = (await svc.entities.TrainingEnrollment.filter({ status: 'active' })).slice(0, 50);
    const report = { dry_run: dryRun, is_friday: isFriday, agents: enrollments.length, directives_fired: 0, reviews_fired: 0, snapshots_written: 0, per_agent: [] };

    for (const e of enrollments) {
      const email = e.user_email;
      const entry = { user_email: email, trigger: null, fired: false, weekly_review: false, snapshot: null, skipped: null };
      try {
        const det = await detectTriggers(svc, e);
        entry.trigger = det.trigger;

        // one proactive directive per agent per day
        if (det.trigger) {
          const sentToday = (await svc.entities.MentorMessage.filter(
            { user_email: email, role: 'mentor', message_kind: 'proactive_directive' }, '-created_date', 1,
          )).some((m) => String(m.created_date).slice(0, 10) === today);
          if (sentToday) {
            entry.skipped = 'directive_already_sent_today';
          } else if (!dryRun) {
            await svc.functions.invoke('mentorOrchestrator', {
              user_email: email, trigger: 'proactive_directive', trigger_detail: `${det.trigger}: ${det.detail}`,
            });
            entry.fired = true;
            report.directives_fired++;
          } else {
            entry.fired = 'would_fire';
          }
        }

        // Friday: weekly review + snapshot
        if (isFriday) {
          const reviewedToday = (await svc.entities.MentorMessage.filter(
            { user_email: email, role: 'mentor', message_kind: 'weekly_review' }, '-created_date', 1,
          )).some((m) => String(m.created_date).slice(0, 10) === today);
          if (!reviewedToday) {
            if (!dryRun) {
              await svc.functions.invoke('mentorOrchestrator', { user_email: email, trigger: 'weekly_review' });
              report.reviews_fired++;
            }
            entry.weekly_review = dryRun ? 'would_fire' : true;
          }
          const score = Math.max(0, Math.min(100, det.components.reflection + det.components.behavior + det.components.streak));
          entry.snapshot = { score, components: det.components, week_number: det.week };
          if (!dryRun) {
            const existing = await svc.entities.PrincipleScoreSnapshot.filter({ user_email: email, week_number: det.week });
            if (!existing.some((s) => s.snapshot_date === today)) {
              await svc.entities.PrincipleScoreSnapshot.create({
                user_email: email, agent_name: e.agent_name || email, week_number: det.week, score, snapshot_date: today,
              });
              report.snapshots_written++;
            }
          }
        }
      } catch (err) {
        entry.skipped = `error: ${String(err?.message || err).slice(0, 200)}`;
      }
      report.per_agent.push(entry);
    }

    return json(200, report);
  } catch (error) {
    console.error('mentorSweep error:', error);
    return json(500, { error: String(error?.message || error) });
  }
});
