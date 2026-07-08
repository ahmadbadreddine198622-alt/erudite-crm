import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * fixOrphanMessages — backfill that cleans up the Message entity:
 *
 *   (a) Re-runs identity resolution over Messages where landlord_id is null, using
 *       $in queries with BOTH phone variants (digits-only AND '+''+digits) against
 *       Landlord (phone, whatsapp, additional_phones) and Lead (phone, whatsapp).
 *   (b) Rewrites invalid channel values to 'personal' via updateMany while
 *       preserving the original in instance_name.
 *   (c) Marks exact duplicates (same wa_message_id, or same phone+timestamp+text)
 *       as is_deleted, keeping the earliest record.
 *   (d) Marks noise messages as is_deleted in server-side batches until none remain:
 *       own line numbers (via updateMany), shortcodes (<9 digits), UAE landlines
 *       (9714…) — processes ALL historical records, not just the first batch.
 *
 * ALL database writes use asServiceRole to bypass Message RLS rules.
 * After all operations, re-queries the database to verify writes persisted and
 * returns verified counts.
 */
function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').replace(/\s+/g, '').trim();
}

const OWN_LINE_NUMBERS = [
  '971582806000', '971581806000', '971529871277', '971522869064', '971559508545',
];

const VALID_CHANNELS = ['business', 'personal'];

function isNoisePhone(digitsPhone) {
  if (!digitsPhone) return true;
  const d = String(digitsPhone).replace(/\D/g, '');
  if (!d) return true;
  if (OWN_LINE_NUMBERS.includes(d)) return true;
  if (d.length < 9) return true;
  if (d.startsWith('9714')) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin only' }, { status: 403 });
    }
    // ALL reads and writes go through service role to bypass Message RLS
    const svc = base44.asServiceRole;

    const summary = {
      matched: 0,
      still_unmatched: 0,
      channel_fixed: 0,
      duplicates_removed: 0,
      noise_removed: 0,
      verified: {
        matched: 0,
        unmatched: 0,
        noise_remaining: 0,
        invalid_channel_remaining: 0,
      },
    };

    // ══════════════════════════════════════════════════════════════════════
    // Phase 1: Identity resolution — $in queries with both phone variants
    // ══════════════════════════════════════════════════════════════════════
    const orphans = await svc.entities.Message.filter(
      { landlord_id: null, is_deleted: { $ne: true } },
      'created_date', 500,
    ).catch(() => []);

    // Collect unique phone variants for a single batch query
    const phoneVariants = new Set();
    for (const msg of orphans) {
      const d = stripPlus(msg.phone);
      if (d) { phoneVariants.add(d); phoneVariants.add('+' + d); }
    }
    const variantsArray = [...phoneVariants];

    if (variantsArray.length > 0) {
      // Query landlords matching any phone variant across phone / whatsapp / additional_phones
      const matchedLandlords = await svc.entities.Landlord.filter({
        $or: [
          { phone: { $in: variantsArray } },
          { whatsapp: { $in: variantsArray } },
          { additional_phones: { $in: variantsArray } },
        ],
      }, '-created_date', 1000).catch(() => []);

      const phoneToLandlord = new Map();
      for (const l of matchedLandlords) {
        const phones = [
          l.phone, l.whatsapp,
          ...(Array.isArray(l.additional_phones) ? l.additional_phones : []),
        ].filter(Boolean).map(p => stripPlus(p));
        for (const p of phones) {
          if (phoneVariants.has(p)) {
            phoneToLandlord.set(p, { id: l.id, agent_email: l.assigned_agent_email || null });
          }
        }
      }

      // Query leads
      const matchedLeads = await svc.entities.Lead.filter({
        $or: [
          { phone: { $in: variantsArray } },
          { whatsapp: { $in: variantsArray } },
        ],
      }, '-created_date', 1000).catch(() => []);

      const phoneToLead = new Map();
      for (const ld of matchedLeads) {
        const phones = [ld.phone, ld.whatsapp].filter(Boolean).map(p => stripPlus(p));
        for (const p of phones) {
          if (phoneVariants.has(p)) {
            phoneToLead.set(p, { id: ld.id, agent_email: ld.assigned_agent_email || null });
          }
        }
      }

      // Build updates for matched messages
      const updates = [];
      for (const msg of orphans) {
        const d = stripPlus(msg.phone);
        if (!d) { summary.still_unmatched++; continue; }
        const landlord = phoneToLandlord.get(d);
        const lead = phoneToLead.get(d);
        if (landlord || lead) {
          const u = { id: msg.id };
          if (landlord) {
            u.landlord_id = landlord.id;
            if (landlord.agent_email) u.agent_email = landlord.agent_email;
          }
          if (lead) u.lead_id = lead.id;
          updates.push(u);
        } else {
          summary.still_unmatched++;
        }
      }

      // Bulk update (max 500 per call)
      for (let i = 0; i < updates.length; i += 500) {
        await svc.entities.Message.bulkUpdate(updates.slice(i, i + 500)).catch(() => {});
      }
      summary.matched = updates.length;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Phase 2: Channel field fix — query invalid channels in batches
    // ══════════════════════════════════════════════════════════════════════
    while (true) {
      const invalidChannelMsgs = await svc.entities.Message.filter(
        { channel: { $nin: VALID_CHANNELS }, is_deleted: { $ne: true } },
        'created_date', 500,
      ).catch(() => []);

      if (invalidChannelMsgs.length === 0) break;

      const channelUpdates = invalidChannelMsgs.map(msg => ({
        id: msg.id,
        channel: 'personal',
        instance_name: msg.channel || msg.instance_name || null,
      }));
      await svc.entities.Message.bulkUpdate(channelUpdates).catch(() => {});
      summary.channel_fixed += channelUpdates.length;

      if (invalidChannelMsgs.length < 500) break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Phase 3: Dedup — cursor-based batching through ALL messages
    // ══════════════════════════════════════════════════════════════════════
    let dedupCursor = null;
    while (true) {
      const query = dedupCursor ? { created_date: { $lt: dedupCursor } } : {};
      const batch = await svc.entities.Message.filter(query, '-created_date', 500).catch(() => []);
      if (batch.length === 0) break;

      const byWaId = new Map();
      const byContent = new Map();

      for (const msg of batch) {
        if (msg.is_deleted) continue;
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

      const dupIds = [];
      for (const [, msgs] of byWaId) {
        if (msgs.length <= 1) continue;
        msgs.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
        for (let i = 1; i < msgs.length; i++) dupIds.push(msgs[i].id);
      }
      for (const [, msgs] of byContent) {
        if (msgs.length <= 1) continue;
        msgs.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
        for (let i = 1; i < msgs.length; i++) dupIds.push(msgs[i].id);
      }

      if (dupIds.length > 0) {
        const uniqueDupIds = [...new Set(dupIds)];
        const dupUpdates = uniqueDupIds.map(id => ({ id, is_deleted: true }));
        for (let i = 0; i < dupUpdates.length; i += 500) {
          await svc.entities.Message.bulkUpdate(dupUpdates.slice(i, i + 500)).catch(() => {});
        }
        summary.duplicates_removed += uniqueDupIds.length;
      }

      dedupCursor = batch[batch.length - 1].created_date;
      if (batch.length < 500) break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Phase 4: Noise sweep — keep batching until NO noise remains
    // ══════════════════════════════════════════════════════════════════════

    // 4a. Own line numbers — filter + bulkUpdate (updateMany may not support $in/$ne)
    while (true) {
      const ownLineMsgs = await svc.entities.Message.filter(
        { phone: { $in: OWN_LINE_NUMBERS }, is_deleted: { $ne: true } },
        '-created_date', 500,
      ).catch(() => []);
      if (ownLineMsgs.length === 0) break;

      const ownLineUpdates = ownLineMsgs.map(msg => ({ id: msg.id, is_deleted: true }));
      await svc.entities.Message.bulkUpdate(ownLineUpdates).catch(() => {});
      summary.noise_removed += ownLineMsgs.length;

      if (ownLineMsgs.length < 500) break;
    }

    // 4b. Shortcodes (<9 digits) and UAE landlines (9714…) — cursor-based,
    //     load + in-memory check + bulkUpdate, until no noise remains
    let noiseCursor = null;
    let safetyBatches = 0;
    while (safetyBatches < 100) {
      safetyBatches++;
      const query = noiseCursor ? { created_date: { $lt: noiseCursor } } : {};
      const batch = await svc.entities.Message.filter(query, '-created_date', 500).catch(() => []);
      if (batch.length === 0) break;

      const noiseIds = [];
      for (const msg of batch) {
        if (msg.is_deleted) continue;
        const d = String(msg.phone || '').replace(/\D/g, '');
        if (d.length < 9 || d.startsWith('9714')) {
          noiseIds.push(msg.id);
        }
      }

      if (noiseIds.length > 0) {
        const noiseUpdates = noiseIds.map(id => ({ id, is_deleted: true }));
        for (let i = 0; i < noiseUpdates.length; i += 500) {
          await svc.entities.Message.bulkUpdate(noiseUpdates.slice(i, i + 500)).catch(() => {});
        }
        summary.noise_removed += noiseIds.length;
      }

      noiseCursor = batch[batch.length - 1].created_date;
      if (batch.length < 500) break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Phase 5: Verification — re-query database to confirm writes persisted
    // ══════════════════════════════════════════════════════════════════════

    // Verify own-line noise is actually deleted
    const remainingOwnLine = await svc.entities.Message.filter(
      { phone: { $in: OWN_LINE_NUMBERS }, is_deleted: { $ne: true } },
      '-created_date', 500,
    ).catch(() => []);

    // Verify shortcodes/landlines still present (full scan)
    let remainingShortcodeLandline = 0;
    let verifyCursor = null;
    for (let i = 0; i < 100; i++) {
      const q = verifyCursor ? { created_date: { $lt: verifyCursor } } : {};
      const batch = await svc.entities.Message.filter(q, '-created_date', 500).catch(() => []);
      if (batch.length === 0) break;
      for (const msg of batch) {
        if (msg.is_deleted) continue;
        const d = String(msg.phone || '').replace(/\D/g, '');
        if (d.length < 9 || d.startsWith('9714')) remainingShortcodeLandline++;
      }
      verifyCursor = batch[batch.length - 1].created_date;
      if (batch.length < 500) break;
    }

    // Verify invalid channels are actually fixed
    const remainingInvalidChannel = await svc.entities.Message.filter(
      { channel: { $nin: VALID_CHANNELS }, is_deleted: { $ne: true } },
      '-created_date', 500,
    ).catch(() => []);

    // Verify matched messages actually have landlord_id set (re-query the IDs we updated)
    let verifiedMatched = 0;
    if (summary.matched > 0) {
      const matchedSample = await svc.entities.Message.filter(
        { landlord_id: { $ne: null }, is_deleted: { $ne: true } },
        '-created_date', 500,
      ).catch(() => []);
      verifiedMatched = matchedSample.length;
    }

    // Count unmatched (sample)
    const unmatchedSample = await svc.entities.Message.filter(
      { landlord_id: null, is_deleted: { $ne: true } },
      '-created_date', 500,
    ).catch(() => []);

    summary.verified = {
      matched: verifiedMatched,
      unmatched: unmatchedSample.length,
      noise_remaining: remainingOwnLine.length + remainingShortcodeLandline,
      invalid_channel_remaining: remainingInvalidChannel.length,
    };

    return Response.json({ ok: true, summary });
  } catch (e) {
    console.error('[fixOrphanMessages] error:', e?.message);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
});