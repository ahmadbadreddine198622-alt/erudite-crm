import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    let svc;
    let mode;
    try {
      svc = base44.asServiceRole;
      if (!svc || !svc.entities) throw new Error('asServiceRole unavailable');
      mode = 'service_role';
    } catch (_e) {
      svc = base44;
      mode = 'user_admin_fallback';
    }

    let body = {};
    try { body = await req.json(); } catch {}
    const cursor = body?.cursor || null;

    const baseQuery = cursor ? { created_date: { $gt: cursor } } : {};
    const attempts = [
      { ...baseQuery, is_deleted: { $ne: true } },
      { ...baseQuery, is_deleted: false },
      { ...baseQuery },
    ];
    let rawBatch = null;
    let lastErr = null;
    for (const q of attempts) {
      try {
        const rows = await svc.entities.Message.filter(q, 'created_date', BATCH_LIMIT);
        if (Array.isArray(rows)) { rawBatch = rows; break; }
      } catch (e) { lastErr = e; }
    }
    if (rawBatch === null) {
      return Response.json({ ok: false, mode, error: 'Message query failed: ' + (lastErr?.message || String(lastErr)) }, { status: 500 });
    }

    if (rawBatch.length === 0) {
      return Response.json({ ok: true, mode, processed: { matched: 0, channel_fixed: 0, noise_removed: 0, duplicates_removed: 0 }, remaining: false, cursor: null });
    }

    const messages = rawBatch.filter((m) => m?.is_deleted !== true);

    const phoneVariants = new Set();
    for (const msg of messages) {
      if (msg.landlord_id || msg.lead_id) continue;
      const d = stripPlus(msg.phone);
      if (d) { phoneVariants.add(d); phoneVariants.add('+' + d); }
    }
    const variantsArray = [...phoneVariants];

    const phoneToLandlord = new Map();
    const phoneToLead = new Map();

    if (variantsArray.length > 0) {
      let landlords = [];
      try {
        landlords = await svc.entities.Landlord.filter({
          $or: [
            { phone: { $in: variantsArray } },
            { whatsapp: { $in: variantsArray } },
            { additional_phones: { $in: variantsArray } },
          ],
        }, '-created_date', 1000);
      } catch (e) {
        return Response.json({ ok: false, mode, error: 'Landlord lookup failed: ' + (e?.message || String(e)) }, { status: 500 });
      }
      for (const l of landlords || []) {
        const phones = [l.phone, l.whatsapp, ...(Array.isArray(l.additional_phones) ? l.additional_phones : [])].filter(Boolean).map(stripPlus);
        for (const p of phones) {
          if (phoneVariants.has(p) && !phoneToLandlord.has(p)) {
            phoneToLandlord.set(p, { id: l.id, agent_email: l.assigned_agent_email || null });
          }
        }
      }

      let leads = [];
      try {
        leads = await svc.entities.Lead.filter({
          $or: [
            { phone: { $in: variantsArray } },
            { whatsapp: { $in: variantsArray } },
          ],
        }, '-created_date', 1000);
      } catch (e) {
        return Response.json({ ok: false, mode, error: 'Lead lookup failed: ' + (e?.message || String(e)) }, { status: 500 });
      }
      for (const ld of leads || []) {
        const phones = [ld.phone, ld.whatsapp].filter(Boolean).map(stripPlus);
        for (const p of phones) {
          if (phoneVariants.has(p) && !phoneToLead.has(p)) {
            phoneToLead.set(p, { id: ld.id, agent_email: ld.assigned_agent_email || null });
          }
        }
      }
    }

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
    const dupedIds = new Set();
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

    const noiseUpdates = [];
    const matchedUpdates = [];
    const dupesUpdates = [];

    for (const msg of messages) {
      const d = stripPlus(msg.phone);
      if (msg.direction === 'incoming' && (OWN_LINE_NUMBERS.includes(d) || d.length < 9 || d.startsWith('9714'))) {
        noiseUpdates.push({ id: msg.id, is_deleted: true });
        continue;
      }
      if (dupedIds.has(msg.id)) {
        dupesUpdates.push({ id: msg.id, is_deleted: true });
        continue;
      }
      if (!msg.landlord_id && !msg.lead_id) {
        const ll = phoneToLandlord.get(d);
        const ld = phoneToLead.get(d);
        if (ll || ld) {
          const u = { id: msg.id };
          if (ll) {
            u.landlord_id = ll.id;
            if (ll.agent_email) u.agent_email = ll.agent_email;
          } else if (ld) {
            u.lead_id = ld.id;
            if (ld.agent_email) u.agent_email = ld.agent_email;
          }
          matchedUpdates.push(u);
        }
      }
    }

    async function applyUpdates(updates) {
      if (!updates.length) return;
      let bulkFailed = false;
      if (typeof svc.entities.Message.bulkUpdate === 'function') {
        try {
          for (let i = 0; i < updates.length; i += 200) {
            await svc.entities.Message.bulkUpdate(updates.slice(i, i + 200));
          }
          return;
        } catch (_e) { bulkFailed = true; }
      }
      for (const u of updates) {
        const { id, ...data } = u;
        await svc.entities.Message.update(id, data);
      }
      if (bulkFailed) console.warn('[fixOrphanMessages] bulkUpdate failed; per-record fallback succeeded');
    }

    try {
      await applyUpdates([...noiseUpdates, ...matchedUpdates, ...dupesUpdates]);
    } catch (e) {
      return Response.json({ ok: false, mode, error: 'Write failed: ' + (e?.message || String(e)) }, { status: 500 });
    }

    const processed = {
      matched: matchedUpdates.length,
      channel_fixed: 0,
      noise_removed: noiseUpdates.length,
      duplicates_removed: dupesUpdates.length,
    };
    const newCursor = rawBatch[rawBatch.length - 1].created_date;
    const remaining = rawBatch.length >= BATCH_LIMIT;

    return Response.json({ ok: true, mode, processed, remaining, cursor: newCursor });
  } catch (e) {
    console.error('[fixOrphanMessages] fatal:', e?.message);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
});