import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// deploy-marker: v4-p2.1 (honest reply_rate + stale-prior pruning)

/**
 * compileBrainPriors — BRAIN V4 P3 LEARN, Phase 2: the nightly self-calibration compiler.
 *
 * Wire a Base44 platform schedule to this function (suggested: daily 01:30 UTC / 05:30 Dubai).
 * Inert until wired; also invocable manually with { dry_run: true } to preview.
 *
 * Three jobs, all degrade-safe and idempotent:
 *
 *  1. DERIVED OUTCOME EVENTS — state-transition events that have no single write-path hook:
 *     - went_dark: pursued landlord (≥2 outbounds), last outbound ≥21d ago, no inbound since,
 *       not terminal. One event per silence window (source_ref keyed on the last outbound).
 *     - appointment_kept / appointment_noshow: from LandlordAppointment.status
 *       completed / no_show.
 *     - deal_closed / mandate_signed / mandate_lost catch-alls: from current Landlord state
 *       (stage === 'deal_closed', mandate_status form_a_signed / expired / cancelled) — the
 *       real-time hooks (parseFormA) cover the live path; this sweep catches human UI edits.
 *     All idempotent via deterministic source_refs; all stamped backfilled:true.
 *
 *  2. PLAYBOOK PRIORS — aggregates over the OutcomeEvent ledger at several granularities
 *     (channel / channel×angle / archetype×channel / nationality×channel / project×channel /
 *     archetype×nationality×channel / full). Upserted by bucket_key into PlaybookPrior.
 *     Buckets with n < 8 are marked low_confidence (the brain must say so when citing them).
 *     Obvious TEST landlords are excluded from priors (never from the ledger itself).
 *
 *  3. CALIBRATION — joins historical LandlordScoreSnapshot.mandate_win_probability against
 *     realized terminal outcomes (signed/closed = 1, lost/went_dark = 0), bins per decile,
 *     computes the Brier score, and writes a BrainCalibration record (is_current flag moved).
 *     The ready-to-inject calibration_line is produced once >= 50 resolved predictions exist.
 *
 * NEVER sends anything. Writes only OutcomeEvent (derived rows), PlaybookPrior, BrainCalibration.
 */

const TIME_BUDGET_MS = 150_000;
const WENT_DARK_DAYS = 21;
const LOW_CONFIDENCE_N = 8;
const MIN_BUCKET_N = 3;
const MAX_BUCKETS = 300;
const CALIBRATION_MIN_RESOLVED = 50;

// Landlords whose events must not train the priors (channel-test records). The LEDGER keeps
// their rows (append-only truth) — they are excluded at compile time only.
const TEST_NAME_RE = /(^|\s)(test|sdadssd|asdasd|asdf|qwerty|demo|dummy)(\s|$)/i;

// ── nationality bucketing — KEEP IN SYNC across compileBrainPriors, landlordOrchestrator,
// forgeApproachDrafts (V4 sync group #3). Coarse buckets so priors accrue usable n.
function natBucket(nationality) {
  const s = String(nationality || '').toLowerCase();
  if (!s) return 'unknown';
  if (/(russia|belarus|ukrain|kazakh|uzbek|azerbaij|armeni|georgi|kyrgyz|tajik|turkmen|moldov)/.test(s)) return 'russian_cis';
  if (/(emirat|saudi|kuwait|qatar|bahrain|oman)/.test(s)) return 'gcc';
  if (/(india|pakistan|banglade|sri lanka|nepal)/.test(s)) return 'south_asia';
  if (/(china|chinese|hong kong|taiwan|japan|korea|singapor|vietnam|thai|malays|indones|philipp)/.test(s)) return 'east_asia';
  if (/(british|united kingdom|uk\b|english|irish|french|german|italian|spanish|dutch|belgi|swiss|austri|swed|norw|danish|finn|portug|greek|polish|czech|romanian|hungar)/.test(s)) return 'western_europe';
  if (/(american|united states|usa|canad|mexic|brazil|argentin|chile|colomb)/.test(s)) return 'americas';
  if (/(egypt|leban|jordan|syria|iraq|iran|turk|morocc|tunis|alger|libya)/.test(s)) return 'mena';
  if (/(nigeri|kenya|south africa|ghana|ethiop)/.test(s)) return 'africa';
  return 'other';
}

const normProj = (s) => String(s || '').toLowerCase().trim().replace(/[\s\-_\.]+/g, ' ');
const median = (a) => {
  const x = a.filter((v) => typeof v === 'number' && isFinite(v)).sort((p, q) => p - q);
  if (!x.length) return null;
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : Math.round(((x[m - 1] + x[m]) / 2) * 10) / 10;
};

Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'admin only' }, { status: 403 });
    }
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const report = {
      dry_run: dryRun,
      derived_events: { went_dark: 0, appointment_kept: 0, appointment_noshow: 0, deal_closed: 0, mandate_signed: 0, mandate_lost: 0, skipped_existing: 0 },
      priors: { buckets_considered: 0, written: 0, low_confidence: 0 },
      calibration: { resolved_landlords: 0, resolved_predictions: 0, brier_score: null, line: '' },
      excluded_test_landlords: 0,
      elapsed_ms: 0,
    };

    // ── Load the ledger + landlord context ──
    const events = await svc.entities.OutcomeEvent.filter({}, '-created_date', 10000).catch(() => []);
    const ledger = Array.isArray(events) ? events : [];
    const existingRefs = new Set(ledger.filter((e) => e?.source_ref).map((e) => `${e.kind}|${e.source_ref}`));

    // Landlord lookups for the ids present in the ledger + terminal-state candidates.
    const ledgerIds = [...new Set(ledger.map((e) => e.landlord_id).filter(Boolean))];
    const landlordById = new Map();
    for (let i = 0; i < ledgerIds.length; i += 100) {
      const page = await svc.entities.Landlord.filter({ id: { $in: ledgerIds.slice(i, i + 100) } }, '-updated_date', 100).catch(() => []);
      for (const l of (Array.isArray(page) ? page : [])) landlordById.set(l.id, l);
    }
    const isTest = (lid) => {
      const l = landlordById.get(lid);
      return l ? TEST_NAME_RE.test(String(l.full_name_en || l.full_name || '')) : false;
    };
    report.excluded_test_landlords = ledgerIds.filter(isTest).length;

    // ═══ 1. DERIVED EVENTS ═══
    const newEvents = [];
    const nowMs = Date.now();

    // went_dark — from the ledger itself (per landlord+channel timelines).
    {
      const byLandlord = new Map();
      for (const e of ledger) {
        if (!e.landlord_id) continue;
        if (!byLandlord.has(e.landlord_id)) byLandlord.set(e.landlord_id, []);
        byLandlord.get(e.landlord_id).push(e);
      }
      for (const [lid, evs] of byLandlord) {
        const l = landlordById.get(lid);
        if (!l) continue;
        if (l.stage === 'deal_closed' || l.mandate_status === 'form_a_signed') continue; // terminal-good
        const sends = evs.filter((e) => e.kind === 'draft_sent' && e.sent_at);
        const replies = evs.filter((e) => e.kind === 'reply_received' && e.responded_at);
        if (sends.length < 2) continue; // not genuinely pursued
        const lastSend = sends.reduce((a, b) => (new Date(a.sent_at) > new Date(b.sent_at) ? a : b));
        const lastSendMs = new Date(lastSend.sent_at).getTime();
        if (nowMs - lastSendMs < WENT_DARK_DAYS * 86400000) continue;
        const inboundAfter = replies.some((r) => new Date(r.responded_at).getTime() > lastSendMs);
        if (inboundAfter) continue;
        const ref = `went_dark:${lid}:${lastSend.source_ref || lastSend.sent_at}`;
        if (existingRefs.has(`went_dark|${ref}`)) { report.derived_events.skipped_existing++; continue; }
        newEvents.push({
          landlord_id: lid, kind: 'went_dark', channel: lastSend.channel || 'other',
          sent_at: new Date(lastSendMs + WENT_DARK_DAYS * 86400000).toISOString(),
          source_ref: ref, backfilled: true,
          landlord_archetype: l.landlord_archetype || '', project_name: l.project_name || '',
          nationality: l.nationality || '', stage: l.stage || '',
          description: `no reply ${WENT_DARK_DAYS}d after last outbound (${lastSend.channel})`,
        });
        report.derived_events.went_dark++;
      }
    }

    // appointment_kept / appointment_noshow
    {
      const appts = await svc.entities.LandlordAppointment.filter({ status: { $in: ['completed', 'no_show'] } }, '-datetime', 2000).catch(() => []);
      for (const a of (Array.isArray(appts) ? appts : [])) {
        if (!a?.landlord_id) continue;
        const kind = a.status === 'completed' ? 'appointment_kept' : 'appointment_noshow';
        const ref = `LandlordAppointment:${a.id}:${a.status}`;
        if (existingRefs.has(`${kind}|${ref}`)) { report.derived_events.skipped_existing++; continue; }
        const l = landlordById.get(a.landlord_id) || await svc.entities.Landlord.get(a.landlord_id).catch(() => null);
        if (l) landlordById.set(l.id, l);
        newEvents.push({
          landlord_id: a.landlord_id, kind, channel: 'other',
          sent_at: a.datetime || new Date().toISOString(),
          source_ref: ref, backfilled: true,
          writer_email: a.agent_email || '',
          landlord_archetype: l?.landlord_archetype || '', project_name: l?.project_name || '',
          nationality: l?.nationality || '', stage: l?.stage || '',
          description: `${a.type || 'appointment'} ${a.status}`,
        });
        report.derived_events[kind]++;
      }
    }

    // Terminal catch-alls from current Landlord state.
    {
      const [closed, signed, lost] = await Promise.all([
        svc.entities.Landlord.filter({ stage: 'deal_closed' }, '-updated_date', 1000).catch(() => []),
        svc.entities.Landlord.filter({ mandate_status: 'form_a_signed' }, '-updated_date', 1000).catch(() => []),
        svc.entities.Landlord.filter({ mandate_status: { $in: ['expired', 'cancelled'] } }, '-updated_date', 1000).catch(() => []),
      ]);
      const push = (l, kind, ref, when, desc) => {
        if (existingRefs.has(`${kind}|${ref}`)) { report.derived_events.skipped_existing++; return; }
        landlordById.set(l.id, l);
        newEvents.push({
          landlord_id: l.id, kind, channel: 'other', sent_at: when, source_ref: ref, backfilled: true,
          landlord_archetype: l.landlord_archetype || '', project_name: l.project_name || '',
          nationality: l.nationality || '', stage: l.stage || '', description: desc,
        });
        report.derived_events[kind]++;
      };
      for (const l of (Array.isArray(closed) ? closed : [])) {
        push(l, 'deal_closed', `stage:${l.id}:deal_closed`, l.stage_entered_at || l.updated_date || new Date().toISOString(), 'stage sweep');
      }
      for (const l of (Array.isArray(signed) ? signed : [])) {
        push(l, 'mandate_signed', `mandate:${l.id}:form_a_signed`, l.mandate_start_date || l.updated_date || new Date().toISOString(), 'mandate sweep');
      }
      for (const l of (Array.isArray(lost) ? lost : [])) {
        push(l, 'mandate_lost', `mandate:${l.id}:${l.mandate_status}`, l.mandate_expires_at || l.updated_date || new Date().toISOString(), `mandate sweep (${l.mandate_status})`);
      }
    }

    if (!dryRun && newEvents.length) {
      for (let i = 0; i < newEvents.length; i += 100) {
        const chunk = newEvents.slice(i, i + 100);
        try { await svc.entities.OutcomeEvent.bulkCreate(chunk); } catch (_) {
          for (const row of chunk) { try { await svc.entities.OutcomeEvent.create(row); } catch (_) { /* skip */ } }
        }
      }
    }

    // ═══ 2. PLAYBOOK PRIORS ═══
    // Work on ledger + newly derived events, excluding test landlords.
    // METRIC DEFINITION: reply_rate = replied_sends / attempts, where a send counts as
    // "replied" when the FIRST inbound on the same landlord+channel lands within 72h after it.
    // (Counting raw reply events would exceed 1.0 — one send often draws a burst of inbound
    // messages.) latency = send → first reply; best hour = hour of the sends that got replies.
    const trainable = [...ledger, ...newEvents].filter((e) => e.landlord_id && !isTest(e.landlord_id));
    const sends = trainable.filter((e) => e.kind === 'draft_sent' && e.sent_at);
    const replies = trainable.filter((e) => e.kind === 'reply_received' && e.responded_at);
    const mandatesByLandlord = new Set(trainable.filter((e) => e.kind === 'mandate_signed').map((e) => e.landlord_id));

    // Per landlord+channel: pair each send with the first reply that follows it (≤72h).
    const REPLY_PAIR_MS = 72 * 3.6e6;
    const repliesByLC = new Map();
    for (const r of replies) {
      const k = `${r.landlord_id}|${r.channel}`;
      if (!repliesByLC.has(k)) repliesByLC.set(k, []);
      repliesByLC.get(k).push(new Date(r.responded_at).getTime());
    }
    for (const arr of repliesByLC.values()) arr.sort((a, b) => a - b);
    const sendRecords = sends.map((s) => {
      const ts = new Date(s.sent_at).getTime();
      const arr = repliesByLC.get(`${s.landlord_id}|${s.channel}`) || [];
      const hit = arr.find((rt) => rt > ts && rt - ts <= REPLY_PAIR_MS);
      return {
        e: s,
        got_reply: hit != null,
        latency: hit != null ? Math.round(((hit - ts) / 3.6e6) * 10) / 10 : null,
      };
    });

    // Bucket levels: [archetype?, project?, nat?, channel?, angle?] — null = 'any'.
    const levels = [
      (e) => ({ ch: e.channel }),
      (e) => (e.angle_used ? { ch: e.channel, an: e.angle_used } : null),
      (e) => (e.landlord_archetype ? { ar: e.landlord_archetype, ch: e.channel } : null),
      (e) => { const nb = natBucket(e.nationality); return nb !== 'unknown' ? { na: nb, ch: e.channel } : null; },
      (e) => (e.project_name ? { pr: normProj(e.project_name), ch: e.channel } : null),
      (e) => { const nb = natBucket(e.nationality); return (e.landlord_archetype && nb !== 'unknown') ? { ar: e.landlord_archetype, na: nb, ch: e.channel } : null; },
      (e) => { const nb = natBucket(e.nationality); return (e.landlord_archetype && e.project_name && nb !== 'unknown' && e.angle_used) ? { ar: e.landlord_archetype, pr: normProj(e.project_name), na: nb, ch: e.channel, an: e.angle_used } : null; },
    ];
    const keyOf = (d) => [d.ar || 'any', d.pr || 'any', d.na || 'any', d.ch || 'any', d.an || 'any'].join('|');

    const buckets = new Map(); // key → {dims, attempts, replied, latencies[], hours[], landlords:Set}
    for (const rec of sendRecords) {
      for (const lv of levels) {
        const dims = lv(rec.e);
        if (!dims) continue;
        const k = keyOf(dims);
        if (!buckets.has(k)) buckets.set(k, { dims, attempts: 0, replied: 0, latencies: [], hours: [], landlords: new Set() });
        const b = buckets.get(k);
        b.attempts++;
        if (rec.got_reply) {
          b.replied++;
          if (rec.latency != null) b.latencies.push(rec.latency);
          if (typeof rec.e.hour_dubai === 'number') b.hours.push(rec.e.hour_dubai);
        }
        b.landlords.add(rec.e.landlord_id);
      }
    }

    report.priors.buckets_considered = buckets.size;
    const rows = [...buckets.values()]
      .map((b) => {
        const n = b.attempts;
        const hourMode = (() => {
          if (b.hours.length < 3) return null;
          const c = {}; let best = null, bn = 0;
          for (const h of b.hours) { c[h] = (c[h] || 0) + 1; if (c[h] > bn) { bn = c[h]; best = h; } }
          return best;
        })();
        return {
          bucket_key: keyOf(b.dims),
          landlord_archetype: b.dims.ar || 'any',
          project_name: b.dims.pr || 'any',
          nationality_bucket: b.dims.na || 'any',
          channel: b.dims.ch || 'any',
          angle_used: b.dims.an || 'any',
          attempts: b.attempts,
          replies: b.replied,
          reply_rate: b.attempts ? Math.round((b.replied / b.attempts) * 1000) / 1000 : null,
          median_latency_hours: median(b.latencies),
          mandates: [...b.landlords].filter((lid) => mandatesByLandlord.has(lid)).length,
          best_hour_dubai: hourMode,
          sample_size: n,
          low_confidence: n < LOW_CONFIDENCE_N,
          compiled_at: new Date().toISOString(),
        };
      })
      .filter((r) => r.sample_size >= MIN_BUCKET_N && r.attempts >= 1)
      .sort((a, b) => b.sample_size - a.sample_size)
      .slice(0, MAX_BUCKETS);

    report.priors.written = rows.length;
    report.priors.low_confidence = rows.filter((r) => r.low_confidence).length;

    if (!dryRun) {
      const existing = await svc.entities.PlaybookPrior.filter({}, '-compiled_at', 5000).catch(() => []);
      const existingByKey = new Map((Array.isArray(existing) ? existing : []).map((p) => [p.bucket_key, p]));
      for (const r of rows) {
        const prev = existingByKey.get(r.bucket_key);
        try {
          if (prev) await svc.entities.PlaybookPrior.update(prev.id, r);
          else await svc.entities.PlaybookPrior.create(r);
        } catch (_) { /* best-effort per row */ }
      }
      // Prune stale buckets: the priors table always equals the CURRENT compile — a bucket that
      // no longer qualifies (metric definition changes, data corrections) must not linger.
      const freshKeys = new Set(rows.map((r) => r.bucket_key));
      for (const [key, prev] of existingByKey) {
        if (!freshKeys.has(key)) {
          try { await svc.entities.PlaybookPrior.delete(prev.id); } catch (_) { /* best-effort */ }
        }
      }
    }

    // ═══ 3. CALIBRATION ═══
    {
      // Terminal outcome per landlord: 1 = signed/closed, 0 = lost/went_dark. Unresolved skipped.
      const outcomeByLandlord = new Map();
      for (const [lid, l] of landlordById) {
        if (isTest(lid)) continue;
        if (l.stage === 'deal_closed' || l.mandate_status === 'form_a_signed') outcomeByLandlord.set(lid, 1);
        else if (l.mandate_status === 'expired' || l.mandate_status === 'cancelled') outcomeByLandlord.set(lid, 0);
      }
      for (const e of [...ledger, ...newEvents]) {
        if (e.kind === 'went_dark' && !outcomeByLandlord.has(e.landlord_id) && !isTest(e.landlord_id)) {
          outcomeByLandlord.set(e.landlord_id, 0);
        }
      }
      report.calibration.resolved_landlords = outcomeByLandlord.size;

      if (outcomeByLandlord.size) {
        // Snapshots of resolved landlords, paged per landlord (bounded).
        const pairs = [];
        const resolvedIds = [...outcomeByLandlord.keys()];
        for (let i = 0; i < resolvedIds.length; i += 50) {
          const page = await svc.entities.LandlordScoreSnapshot.filter(
            { landlord_id: { $in: resolvedIds.slice(i, i + 50) } }, '-captured_at', 1000
          ).catch(() => []);
          for (const s of (Array.isArray(page) ? page : [])) {
            const p = s.mandate_win_probability;
            if (typeof p === 'number' && isFinite(p) && p >= 0 && p <= 1) {
              pairs.push({ p, y: outcomeByLandlord.get(s.landlord_id) });
            }
          }
        }
        report.calibration.resolved_predictions = pairs.length;

        if (pairs.length) {
          const brier = pairs.reduce((acc, { p, y }) => acc + (p - y) * (p - y), 0) / pairs.length;
          report.calibration.brier_score = Math.round(brier * 1000) / 1000;

          const deciles = [];
          for (let d = 0; d < 10; d++) {
            const lo = d / 10, hi = (d + 1) / 10;
            const inBand = pairs.filter(({ p }) => p >= lo && (d === 9 ? p <= hi : p < hi));
            if (!inBand.length) continue;
            deciles.push({
              decile: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
              predicted_avg: Math.round((inBand.reduce((a, { p }) => a + p, 0) / inBand.length) * 1000) / 1000,
              actual_rate: Math.round((inBand.reduce((a, { y }) => a + y, 0) / inBand.length) * 1000) / 1000,
              n: inBand.length,
            });
          }

          let line = '';
          if (pairs.length >= CALIBRATION_MIN_RESOLVED) {
            const worst = deciles.filter((d) => d.n >= 10)
              .sort((a, b) => Math.abs(b.predicted_avg - b.actual_rate) - Math.abs(a.predicted_avg - a.actual_rate))[0];
            if (worst && Math.abs(worst.predicted_avg - worst.actual_rate) >= 0.1) {
              line = `CALIBRATION: your ${worst.decile} win-probability predictions have historically converted at ${worst.actual_rate} (n=${worst.n}; Brier ${report.calibration.brier_score}) — correct your mandate_win_probability accordingly.`;
            } else {
              line = `CALIBRATION: your win-probability predictions are tracking outcomes (Brier ${report.calibration.brier_score} over ${pairs.length} resolved predictions) — maintain current calibration.`;
            }
          }
          report.calibration.line = line;

          if (!dryRun) {
            try {
              const current = await svc.entities.BrainCalibration.filter({ is_current: true }, '-computed_at', 5).catch(() => []);
              for (const c of (Array.isArray(current) ? current : [])) {
                try { await svc.entities.BrainCalibration.update(c.id, { is_current: false }); } catch (_) { /* */ }
              }
              await svc.entities.BrainCalibration.create({
                computed_at: new Date().toISOString(),
                resolved_n: pairs.length,
                brier_score: report.calibration.brier_score,
                deciles,
                calibration_line: line,
                is_current: true,
              });
            } catch (calErr) {
              console.error('BrainCalibration write failed (non-fatal):', calErr?.message);
            }
          }
        }
      }
    }

    report.elapsed_ms = Date.now() - startedAt;
    return Response.json(report);
  } catch (error) {
    console.error('compileBrainPriors error:', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
