import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * fixOrphanMessages — batch-limited backfill for the Message entity.
 *
 * EVERY database operation (reads AND writes) goes through base44.asServiceRole
 * to bypass Message RLS, which otherwise filters reads to an empty result set
 * for non-owner agents.
 *
 * Processes max 300 candidate messages per invocation (oldest-first, cursor-based):
 *   (a) Orphan re-match: landlord_id null AND lead_id null → resolved against
 *       Landlord (phone, whatsapp, additional_phones) and Lead (phone, whatsapp)
 *       using $in with BOTH variants (digits-only AND '+digits).
 *   (b) Noise soft-delete: inbound messages from own line numbers
 *       (971581806000, 971582806000), shortcodes (<9 digits), UAE landlines
 *       (9714…) — only when is_deleted is currently false.
 *   (c) Duplicate soft-delete: within-batch duplicates by wa_message_id
 *       (keeps earliest), falling back to phone+timestamp+text.
 *
 * Returns { ok, processed: {matched, channel_fixed, noise_removed, duplicates_removed},
 *          remaining: bool, cursor: <new cursor or null> }.
 * Frontend loops while remaining=true, passing cursor back each time.
 */
function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').replace(/\s+/g, '').trim();
}

const OWN_LINE_NUMBERS = ['971581806000', '971582806000'];
const BATCH_LIMIT = 300;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin only' }, { status: 403 });
    }
    // ALL reads and writes go through service role to bypass Message RLS
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch {}
    const cursor = body?.cursor || null;

    // ── Load batch: 300 oldest non-deleted messages after cursor ──
    const query = { is_deleted: { $ne: true } };
    if (cursor) query.created_date = { $gt: cursor };
    const messages = await svc.entities.Message.filter(query, 'created_date', BATCH_LIMIT).catch(() => []);

    if (messages.length === 0) {
      return Response.json({ ok: true, processed: { matched: 0, channel_fixed: 0, noise_removed: 0, duplicates_removed: 0 }, remaining: false, cursor: null });
    }

    // ── Build phone-variant index for orphan resolution (both formats) ──
    const phoneVariants = new Set();
    for (const msg of messages) {
      if (msg.landlord_id || msg.lead_id) continue; // already matched — skip
      const d = stripPlus(msg.phone);
      if (d) { phoneVariants.add(d); phoneVariants.add('+' + d); }
    }
    const variantsArray = [...phoneVariants];

    const phoneToLandlord = new Map();
    const phoneToLead = new Map();

    if (variantsArray.length > 0) {
      // Landlords — match across phone / whatsapp / additional_phones
      const landlords = await svc.entities.Landlord.filter({
        $or: [
          { phone: { $in: variantsArray } },
          { whatsapp: { $in: variantsArray } },
          { additional_phones: { $in: variantsArray } },
        ],
      }, '-created_date', 1000).catch(() => []);
      for (const l of landlords) {
        const phones = [
          l.phone, l.whatsapp,
          ...(Array.isArray(l.additional_phones) ? l.additional_phones : []),
        ].filter(Boolean).map(stripPlus);
        for (const p of phones) {
          if (phoneVariants.has(p)) {
            phoneToLandlord.set(p, { id: l.id, agent_email: l.assigned_agent_email || null });
          }
        }
      }

      // Leads — match across phone / whatsapp
      const leads = await svc.entities.Lead.filter({
        $or: [
          { phone: { $in: variantsArray } },
          { whatsapp: { $in: variantsArray } },
        ],
      }, '-created_date', 1000).catch(() => []);
      for (const ld of leads) {
        const phones = [ld.phone, ld.whatsapp].filter(Boolean).map(stripPlus);
        for (const p of phones) {
          if (phoneVariants.has(p)) {
            phoneToLead.set(p, { id: ld.id, agent_email: ld.assigned_agent_email || null });
          }
        }
      }
    }

    // ── Within-batch dedup index: wa_message_id → messages ──
    const byWaId = new Map();
    const byContent = new Map();
    for (const msg of messages) {
      if (msg.wa_message_id) {
        if (!byWaId.has(msg.wa_message_id)) byWaId.set(msg.wa_message_id, []);
        byWaId.get(msg.wa_message_id).push(msg);
      }
      if (msg.phone && msg.timestamp && msg.text) {
        const key = msg.phone + '|' + msg.timestamp + '|' + msg.text;
        if (!byContent.has(key)) byContent.set(key, []);
        byContent.get(key).push(msg);
      }
    }

    // ── Classify each message into an update bucket ──
    const noiseUpdates = [];
    const matchedUpdates = [];
    const dupesUpdates = [];
    const dupedIds = new Set();

    // Duplicates — mark all but the earliest in each group
    for (const [, msgs] of byWaId) {
      if (msgs.length <= 1) continue;
      msgs.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
      for (let i = 1; i < msgs.length; i++) dupedIds.add(msgs[i].id);
    }
    for (const [, msgs] of byContent) {
      if (msgs.length <= 1) continue;
      msgs.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
      for (let i = 1; i < msgs.length; i++) dupedIds.add(msgs[i].id);
    }

    for (const msg of messages) {
      const d = stripPlus(msg.phone);

      // (b) Noise — inbound only, own lines / shortcodes / UAE landlines
      if (msg.direction === 'incoming' && (OWN_LINE_NUMBERS.includes(d) || d.length < 9 || d.startsWith('9714'))) {
        noiseUpdates.push({ id: msg.id, is_deleted: true });
        continue;
      }

      // (c) Duplicate
      if (dupedIds.has(msg.id)) {
        dupesUpdates.push({ id: msg.id, is_deleted: true });
        continue;
      }

      // (a) Orphan re-match — landlord_id null AND lead_id null
      if (!msg.landlord_id && !msg.lead_id) {
        const ll = phoneToLandlord.get(d);
        const ld = phoneToLead.get(d);
        if (ll || ld) {
          const u = { id: msg.id };
          if (ll) {
            u.landlord_id = ll.id;
            if (ll.agent_email) u.agent_email = ll.agent_email;
          }
          if (ld) u.lead_id = ld.id;
          matchedUpdates.push(u);
        }
      }
    }

    // ── Apply all writes via service-role bulkUpdate (max 500 per call) ──
    const allUpdates = [...noiseUpdates, ...matchedUpdates, ...dupesUpdates];
    for (let i = 0; i < allUpdates.length; i += 500) {
      await svc.entities.Message.bulkUpdate(allUpdates.slice(i, i + 500)).catch(() => {});
    }

    const processed = {
      matched: matchedUpdates.length,
      channel_fixed: 0,
      noise_removed: noiseUpdates.length,
      duplicates_removed: dupesUpdates.length,
    };

    const newCursor = messages[messages.length - 1].created_date;
    const remaining = messages.length >= BATCH_LIMIT;

    return Response.json({ ok: true, processed, remaining, cursor: newCursor });
  } catch (e) {
    console.error('[fixOrphanMessages] error:', e?.message);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
});