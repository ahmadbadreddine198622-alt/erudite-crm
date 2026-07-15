import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * backfillOutcomeEvents — BRAIN V4 P3 LEARN, Phase 1 history backfill.
 *
 * Derives OutcomeEvent rows (draft_sent / reply_received) from the existing message history:
 * Message (WhatsApp; skips imessage/email mirror rows), IMessage, TelegramMessage, Email.
 * All derived rows are stamped `backfilled: true`.
 *
 * Safety:
 *  - dry_run DEFAULTS TO TRUE — returns per-landlord counts without writing anything.
 *  - Idempotent: skips events whose source_ref already exists, AND skips any event whose
 *    (kind, channel, text_head) matches an existing event within ±10 minutes — this also
 *    protects against ref-scheme differences vs the live hooks (WhatsAppMessage vs Message ids).
 *  - Honest attribution: historical sends get an angle ONLY when the Message row itself carries
 *    forge provenance (ai_source === 'forgeApproachDrafts' / ai_draft_text) — old sends are never
 *    matched against TODAY's drafts (drafts rotate; that would fabricate attribution).
 *  - Reply linking: chronological per landlord+channel — each inbound links to the latest prior
 *    outbound within 72h (latency_hours; linked_event_id only when the outbound event is created
 *    in the same run or already exists with a known id).
 *  - Time-budgeted + batched like the other backfills; re-run with `skip` to continue.
 *
 * Targeting: the landlord book is 5000+ rows (bulk registry imports), but only landlords with
 * actual message history can yield events — so targets are the DISTINCT landlord_ids found in
 * the four message tables (one bulk read each), not a scan of the whole book.
 *
 * Params: { dry_run=true, max_landlords=100, skip=0, landlord_id=null }
 */

const TIME_BUDGET_MS = 150_000;
const REPLY_WINDOW_MS = 72 * 3.6e6;

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const hourDubai = (iso) => {
  const t = new Date(iso || 0);
  if (isNaN(t)) return null;
  return (t.getUTCHours() + 4) % 24;
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
    const dryRun = body.dry_run !== false;            // default TRUE — must pass dry_run:false to write
    const maxLandlords = Number(body.max_landlords) > 0 ? Number(body.max_landlords) : 100;
    const skip = Number(body.skip) >= 0 ? Number(body.skip) : 0;
    const onlyLandlordId = body.landlord_id || null;

    // Candidate landlord ids — DISTINCT landlord_ids that actually appear in message history.
    // Loud on failure: a failed bulk read aborts (a silent [] would under-backfill invisibly).
    let targetIds = [];
    if (onlyLandlordId) {
      targetIds = [onlyLandlordId];
    } else {
      const [msgs, ims, tgs, ems] = await Promise.all([
        svc.entities.Message.filter({ landlord_id: { $ne: null } }, '-timestamp', 5000),
        svc.entities.IMessage.filter({ landlord_id: { $ne: null } }, '-sent_at', 2000),
        svc.entities.TelegramMessage.filter({ landlord_id: { $ne: null } }, '-sent_at', 2000),
        svc.entities.Email.filter({ landlord_id: { $ne: null } }, '-received_at', 2000),
      ]);
      const ids = new Set();
      for (const rows of [msgs, ims, tgs, ems]) {
        for (const r of (Array.isArray(rows) ? rows : [])) {
          if (r?.landlord_id) ids.add(r.landlord_id);
        }
      }
      targetIds = Array.from(ids).sort();  // stable order for skip pagination
    }
    const pagedIds = targetIds.slice(skip, skip + maxLandlords);
    const landlords = [];
    for (const id of pagedIds) {
      const one = await svc.entities.Landlord.get(id).catch(() => null);
      if (one) landlords.push(one);
    }
    if (onlyLandlordId && !landlords.length) {
      return Response.json({ error: 'landlord not found' }, { status: 404 });
    }

    const report = {
      dry_run: dryRun, skip, total_targets: targetIds.length, scanned: 0, landlords_with_events: 0,
      would_create: 0, created: 0, skipped_existing: 0, replies_linked: 0,
      elapsed_ms: 0, has_more: false, next_skip: null, samples: []
    };

    for (const landlord of landlords) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        report.has_more = true;
        report.next_skip = skip + report.scanned;
        break;
      }
      report.scanned++;
      const lid = landlord.id;

      // ── Load history (all degrade-safe) ──
      const [messages, imessages, telegrams, emails, existingEvents] = await Promise.all([
        svc.entities.Message.filter({ landlord_id: lid }, '-timestamp', 200).catch(() => []),
        svc.entities.IMessage.filter({ landlord_id: lid }, '-sent_at', 200).catch(() => []),
        svc.entities.TelegramMessage.filter({ landlord_id: lid }, '-sent_at', 200).catch(() => []),
        svc.entities.Email.filter({ landlord_id: lid }, '-received_at', 200).catch(() => []),
        svc.entities.OutcomeEvent.filter({ landlord_id: lid }, '-created_date', 500).catch(() => []),
      ]);

      // ── Normalize into one timeline ──
      const timeline = [];
      for (const m of (Array.isArray(messages) ? messages : [])) {
        if (!m || !m.timestamp) continue;
        if (m.channel === 'imessage' || m.channel === 'email') continue; // mirrors — sourced from their own tables
        if (m.is_deleted) continue;
        timeline.push({
          channel: 'whatsapp',
          out: m.direction === 'outgoing',
          ts: new Date(m.timestamp).getTime(),
          iso: m.timestamp,
          ref: `Message:${m.id}`,
          text: m.text || m.caption || '',
          writer: m.agent_email || '',
          forge: m.created_from_ai === true && m.ai_source === 'forgeApproachDrafts',
        });
      }
      for (const m of (Array.isArray(imessages) ? imessages : [])) {
        if (!m || !m.sent_at) continue;
        timeline.push({
          channel: 'imessage',
          out: m.direction === 'outbound',
          ts: new Date(m.sent_at).getTime(),
          iso: m.sent_at,
          ref: `IMessage:${m.bb_guid || m.id}`,
          text: m.body || '',
          writer: m.agent_email || '',
          forge: false,
        });
      }
      for (const m of (Array.isArray(telegrams) ? telegrams : [])) {
        if (!m || !m.sent_at) continue;
        timeline.push({
          channel: 'telegram',
          out: m.direction === 'outbound',
          ts: new Date(m.sent_at).getTime(),
          iso: m.sent_at,
          ref: `TelegramMessage:${m.tg_message_id || m.id}`,
          text: m.body || '',
          writer: m.agent_email || '',
          forge: false,
        });
      }
      for (const m of (Array.isArray(emails) ? emails : [])) {
        if (!m || !m.received_at) continue;
        timeline.push({
          channel: 'email',
          out: m.direction === 'outbound',
          ts: new Date(m.received_at).getTime(),
          iso: m.received_at,
          ref: `Email:${m.gmail_message_id || m.id}`,
          text: m.subject ? `${m.subject}\n${m.body_text || m.snippet || ''}` : (m.body_text || m.snippet || ''),
          writer: m.from_email || '',
          forge: false,
        });
      }
      timeline.sort((a, b) => a.ts - b.ts);
      if (!timeline.length) continue;

      // ── Existing-event dedupe indexes ──
      const existing = Array.isArray(existingEvents) ? existingEvents : [];
      const existingRefs = new Set(existing.filter((e) => e?.source_ref).map((e) => `${e.kind}|${e.source_ref}`));
      const existingFuzzy = existing.map((e) => ({
        kind: e.kind, channel: e.channel, head: e.text_head || '',
        ts: new Date(e.sent_at || e.responded_at || e.created_date || 0).getTime(),
      }));
      const fuzzyDupe = (kind, channel, head, ts) => existingFuzzy.some((e) =>
        e.kind === kind && e.channel === channel && e.head && e.head === head &&
        Math.abs(e.ts - ts) <= 10 * 60 * 1000
      );

      // ── Walk the timeline, build events ──
      const toCreate = [];
      const lastOutboundBy = {}; // channel → { ts, entry }
      const snapshot = {
        landlord_archetype: landlord.landlord_archetype || '',
        project_name: landlord.project_name || '',
        nationality: landlord.nationality || '',
        stage: landlord.stage || '', // today's stage — history has no stage record; acceptable for backfill
      };

      for (const item of timeline) {
        const head = norm(item.text).slice(0, 120);
        if (item.out) {
          lastOutboundBy[item.channel] = { ts: item.ts, item };
          const kind = 'draft_sent';
          if (existingRefs.has(`${kind}|${item.ref}`)) { report.skipped_existing++; continue; }
          if (head && fuzzyDupe(kind, item.channel, head, item.ts)) { report.skipped_existing++; continue; }
          toCreate.push({
            landlord_id: lid, kind, channel: item.channel,
            angle_used: '', mode: '', situation: '',
            writer_email: item.writer, sent_at: item.iso,
            source_ref: item.ref, text_head: head,
            hour_dubai: hourDubai(item.iso), backfilled: true,
            ...snapshot,
            ...(item.forge ? { description: 'backfill: forge-provenance send (angle unknown historically)' } : {}),
          });
        } else {
          const kind = 'reply_received';
          const lastOut = lastOutboundBy[item.channel];
          const linked = lastOut && (item.ts - lastOut.ts) >= 0 && (item.ts - lastOut.ts) <= REPLY_WINDOW_MS;
          if (existingRefs.has(`${kind}|${item.ref}`)) { report.skipped_existing++; continue; }
          if (head && fuzzyDupe(kind, item.channel, head, item.ts)) { report.skipped_existing++; continue; }
          const ev = {
            landlord_id: lid, kind, channel: item.channel,
            angle_used: '', mode: '', situation: '',
            responded_at: item.iso,
            source_ref: item.ref, text_head: head,
            hour_dubai: hourDubai(item.iso), backfilled: true,
            ...snapshot,
          };
          if (linked) {
            ev.latency_hours = Math.round(((item.ts - lastOut.ts) / 3.6e6) * 10) / 10;
            report.replies_linked++;
          }
          toCreate.push(ev);
        }
      }

      if (!toCreate.length) continue;
      report.landlords_with_events++;
      report.would_create += toCreate.length;
      if (report.samples.length < 5) {
        report.samples.push({ landlord_id: lid, name: landlord.full_name_en || '', events: toCreate.length, first: toCreate[0] });
      }

      if (!dryRun) {
        for (let i = 0; i < toCreate.length; i += 100) {
          const chunk = toCreate.slice(i, i + 100);
          try {
            await svc.entities.OutcomeEvent.bulkCreate(chunk);
            report.created += chunk.length;
          } catch (e) {
            // fall back to per-row create so one bad row doesn't sink the chunk
            for (const row of chunk) {
              try { await svc.entities.OutcomeEvent.create(row); report.created++; } catch (_) { /* skip */ }
            }
          }
        }
      }
    }

    if (!report.has_more && skip + pagedIds.length < targetIds.length) {
      report.has_more = true;
      report.next_skip = skip + pagedIds.length;
    }
    report.elapsed_ms = Date.now() - startedAt;
    return Response.json(report);
  } catch (error) {
    console.error('backfillOutcomeEvents error:', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
