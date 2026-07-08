import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * fixOrphanMessages — backfill that cleans up the Message entity:
 *
 *   (a) Re-runs identity resolution over all Messages where landlord_id is null and links matches.
 *   (b) Rewrites invalid channel values ('malik', 'sameie', anything not business/personal) to
 *       'personal' while moving the original value into instance_name.
 *   (c) Marks exact duplicates (same wa_message_id, or same phone+timestamp+text) as is_deleted
 *       keeping the earliest record.
 *   (d) Marks self-echo and noise messages (own line numbers, shortcodes <9 digits, UAE landlines
 *       starting with 9714) as is_deleted.
 *
 * Processes up to 2000 messages per run. Safe to re-run — each pass reduces the orphaned set.
 * Returns { ok, summary: { matched, still_unmatched, channel_fixed, duplicates_removed, noise_removed } }.
 */
function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').replace(/\s+/g, '').trim();
}

const OWN_LINE_NUMBERS = new Set([
  '971582806000', '971581806000', '971529871277', '971522869064', '971559508545',
]);

const VALID_CHANNELS = new Set(['business', 'personal']);

function isNoisePhone(digitsPhone) {
  if (!digitsPhone) return true;
  const d = String(digitsPhone).replace(/\D/g, '');
  if (!d) return true;
  if (OWN_LINE_NUMBERS.has(d)) return true;
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
    const svc = base44.asServiceRole;

    const summary = {
      matched: 0,
      still_unmatched: 0,
      channel_fixed: 0,
      duplicates_removed: 0,
      noise_removed: 0,
    };

    // Load landlord + lead phone indexes once for batch identity resolution
    const landlords = await svc.entities.Landlord.list('-created_date', 2000).catch(() => []);
    const leads = await svc.entities.Lead.list('-created_date', 2000).catch(() => []);

    function resolveIdentity(digitsPhone) {
      const digits = stripPlus(digitsPhone);
      if (!digits) return { landlord_id: null, lead_id: null, agent_email: null };
      for (const l of landlords) {
        if (stripPlus(l.phone) === digits || stripPlus(l.whatsapp) === digits) {
          return { landlord_id: l.id, lead_id: null, agent_email: l.assigned_agent_email || null };
        }
        const extras = Array.isArray(l.additional_phones) ? l.additional_phones : [];
        if (extras.some(e => stripPlus(e) === digits)) {
          return { landlord_id: l.id, lead_id: null, agent_email: l.assigned_agent_email || null };
        }
      }
      for (const ld of leads) {
        if (stripPlus(ld.phone) === digits || stripPlus(ld.whatsapp) === digits) {
          return { landlord_id: null, lead_id: ld.id, agent_email: ld.assigned_agent_email || null };
        }
      }
      return { landlord_id: null, lead_id: null, agent_email: null };
    }

    // Load all messages (up to 2000, oldest first for backfill)
    const allMessages = await svc.entities.Message.list('created_date', 2000).catch(() => []);
    const deletedIds = new Set();

    // ── Phase 1: Identity resolution for messages with null landlord_id ──
    for (const msg of allMessages) {
      if (deletedIds.has(msg.id) || msg.is_deleted || msg.landlord_id) continue;
      const { landlord_id, lead_id, agent_email } = resolveIdentity(msg.phone);
      if (landlord_id || lead_id) {
        const update = {};
        if (landlord_id) update.landlord_id = landlord_id;
        if (lead_id) update.lead_id = lead_id;
        if (agent_email && !msg.agent_email) update.agent_email = agent_email;
        try {
          await svc.entities.Message.update(msg.id, update);
          summary.matched++;
        } catch (e) { /* skip on error */ }
      } else {
        summary.still_unmatched++;
      }
    }

    // ── Phase 2: Channel field fix ──
    for (const msg of allMessages) {
      if (deletedIds.has(msg.id) || msg.is_deleted) continue;
      if (msg.channel && VALID_CHANNELS.has(msg.channel)) continue;
      const originalChannel = msg.channel || '';
      try {
        await svc.entities.Message.update(msg.id, {
          channel: 'personal',
          instance_name: originalChannel || msg.instance_name || null,
        });
        summary.channel_fixed++;
      } catch (e) { /* skip */ }
    }

    // ── Phase 3a: Dedup by wa_message_id (keep earliest, mark rest deleted) ──
    const byWaId = new Map();
    for (const msg of allMessages) {
      if (deletedIds.has(msg.id) || msg.is_deleted || !msg.wa_message_id) continue;
      const key = msg.wa_message_id;
      if (!byWaId.has(key)) byWaId.set(key, []);
      byWaId.get(key).push(msg);
    }
    for (const [, msgs] of byWaId) {
      if (msgs.length <= 1) continue;
      msgs.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
      for (let i = 1; i < msgs.length; i++) {
        try {
          await svc.entities.Message.update(msgs[i].id, { is_deleted: true });
          deletedIds.add(msgs[i].id);
          summary.duplicates_removed++;
        } catch (e) { /* skip */ }
      }
    }

    // ── Phase 3b: Dedup by phone+timestamp+text (keep earliest) ──
    const byContent = new Map();
    for (const msg of allMessages) {
      if (deletedIds.has(msg.id) || msg.is_deleted || !msg.phone || !msg.timestamp || !msg.text) continue;
      const key = msg.phone + '|' + msg.timestamp + '|' + msg.text;
      if (!byContent.has(key)) byContent.set(key, []);
      byContent.get(key).push(msg);
    }
    for (const [, msgs] of byContent) {
      if (msgs.length <= 1) continue;
      msgs.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
      for (let i = 1; i < msgs.length; i++) {
        try {
          await svc.entities.Message.update(msgs[i].id, { is_deleted: true });
          deletedIds.add(msgs[i].id);
          summary.duplicates_removed++;
        } catch (e) { /* skip */ }
      }
    }

    // ── Phase 4: Noise removal (own line numbers, shortcodes, UAE landlines) ──
    for (const msg of allMessages) {
      if (deletedIds.has(msg.id) || msg.is_deleted) continue;
      if (isNoisePhone(msg.phone)) {
        try {
          await svc.entities.Message.update(msg.id, { is_deleted: true });
          deletedIds.add(msg.id);
          summary.noise_removed++;
        } catch (e) { /* skip */ }
      }
    }

    return Response.json({ ok: true, summary });
  } catch (e) {
    console.error('[fixOrphanMessages] error:', e?.message);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
});