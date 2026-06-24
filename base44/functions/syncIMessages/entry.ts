import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Normalize a phone number to E.164 (UAE default +971). Pass Apple ID emails through unchanged.
function normalizeAddress(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('971')) return '+' + digits;
  if (digits.startsWith('0')) return '+971' + digits.slice(1);
  return '+971' + digits;
}

// Build a set of normalized addresses for a landlord (primary, whatsapp, additional).
function landlordAddresses(L) {
  const out = new Set();
  [L.phone, L.whatsapp, ...(Array.isArray(L.additional_phones) ? L.additional_phones : [])]
    .filter(Boolean)
    .forEach((p) => out.add(normalizeAddress(p)));
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-gated bulk job (matches processDueScheduledMessages). The work below uses asServiceRole,
    // which bypasses RLS — so an open endpoint would let any anonymous caller trigger a full
    // BlueBubbles pull + bulk writes across all landlords. (If a cron must run this unauthenticated,
    // gate the no-user path behind a shared-secret header instead of leaving it open.)
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // How far back to pull, in days (default 30). Scheduled runs pass a small window.
    const lookbackDays = Number(body.lookback_days) > 0 ? Number(body.lookback_days) : 30;
    const limit = Number(body.limit) > 0 ? Math.min(Number(body.limit), 1000) : 500;

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    if (!serverUrl || !password) {
      return Response.json({ error: 'BlueBubbles server is not configured' }, { status: 500 });
    }

    // 1. Build a phone → landlord_id lookup across all landlords.
    const landlords = await base44.asServiceRole.entities.Landlord.list('-updated_date', 5000);
    const addressToLandlord = new Map();
    for (const L of landlords) {
      for (const addr of landlordAddresses(L)) {
        if (addr && !addressToLandlord.has(addr)) addressToLandlord.set(addr, L.id);
      }
    }

    // 2. Query BlueBubbles for recent messages (newest first), with the handle/chat included.
    const afterTs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const queryUrl = `${serverUrl}/api/v1/message/query?password=${encodeURIComponent(password)}`;
    const resp = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify({
        // NOTE: do NOT send `offset` — the Zrok share's request filter rejects the
        // { sort, after, offset } combination with a 403 (offset defaults to 0 anyway).
        limit,
        with: ['handle', 'chats'],
        sort: 'DESC',
        after: afterTs,
      }),
    });

    const raw = await resp.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!resp.ok) {
      return Response.json({ error: 'BlueBubbles query failed', status: resp.status, detail: raw?.slice(0, 500) }, { status: 502 });
    }

    const messages = Array.isArray(data?.data) ? data.data : [];

    // 3. Map each message to a landlord and prepare records to import.
    const candidates = [];
    for (const m of messages) {
      const guid = m?.guid;
      if (!guid) continue;
      const text = m?.text || '';
      if (!text.trim()) continue; // skip attachment-only / empty for now

      // Counterparty address: the handle on the message (sender for inbound), or chat participant.
      let counterparty = m?.handle?.address || (Array.isArray(m?.chats) && m.chats[0]?.chatIdentifier) || '';
      counterparty = normalizeAddress(counterparty);
      const landlordId = addressToLandlord.get(counterparty);
      if (!landlordId) continue;

      const isFromMe = m?.isFromMe === true || m?.isFromMe === 1;
      const tsMs = m?.dateCreated || m?.dateDelivered || Date.now();

      candidates.push({
        bb_guid: guid,
        landlord_id: landlordId,
        direction: isFromMe ? 'outbound' : 'inbound',
        address: counterparty,
        body: text,
        status: 'delivered',
        sent_at: new Date(tsMs).toISOString(),
      });
    }

    if (candidates.length === 0) {
      return Response.json({ success: true, scanned: messages.length, matched: 0, imported: 0 });
    }

    // 4. Dedup against already-imported messages by GUID. Fail CLOSED: there is no DB unique
    // constraint on bb_guid, so this lookup is the ONLY idempotency gate — if it errors we must NOT
    // proceed, because an empty "existing" set would re-import the entire batch as duplicates. Chunk
    // the $in to stay well under backend query-size limits.
    const guids = candidates.map((c) => c.bb_guid);
    const existingGuids = new Set();
    try {
      for (let i = 0; i < guids.length; i += 200) {
        const slice = guids.slice(i, i + 200);
        const existing = await base44.asServiceRole.entities.IMessage.filter({ bb_guid: { $in: slice } }, '-sent_at', slice.length);
        for (const e of (existing || [])) { if (e.bb_guid) existingGuids.add(e.bb_guid); }
      }
    } catch (dedupErr) {
      return Response.json({ error: 'Dedup lookup failed — aborting to avoid duplicate import', detail: String(dedupErr?.message || dedupErr) }, { status: 502 });
    }

    const toCreate = candidates.filter((c) => !existingGuids.has(c.bb_guid));

    let imported = 0;
    // Bulk create in chunks of 100.
    for (let i = 0; i < toCreate.length; i += 100) {
      const chunk = toCreate.slice(i, i + 100);
      if (chunk.length === 0) continue;
      await base44.asServiceRole.entities.IMessage.bulkCreate(chunk);
      imported += chunk.length;
    }

    // Mirror the newly-imported iMessages (both directions) into the unified Message entity so
    // landlordOrchestrator — which reads conversation history ONLY from Message — sees iMessages
    // (especially inbound landlord replies). Same GUID dedup as above (only `toCreate`); best-effort.
    const messageRows = toCreate.map((c) => ({
      landlord_id: c.landlord_id,
      phone: c.address,
      direction: c.direction === 'outbound' ? 'outgoing' : 'incoming',
      text: c.body,
      timestamp: c.sent_at,
      status: c.status,
      channel: 'imessage',
      wa_message_id: c.bb_guid,
    }));
    for (let i = 0; i < messageRows.length; i += 100) {
      const chunk = messageRows.slice(i, i + 100);
      if (chunk.length === 0) continue;
      try { await base44.asServiceRole.entities.Message.bulkCreate(chunk); } catch (_) { /* best-effort mirror */ }
    }

    return Response.json({
      success: true,
      scanned: messages.length,
      matched: candidates.length,
      imported,
      skipped_existing: candidates.length - toCreate.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});