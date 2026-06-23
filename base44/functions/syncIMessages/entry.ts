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

    // Allow authenticated users OR scheduled runs (no user). Reject anonymous HTTP if a user context exists but is invalid.
    const user = await base44.auth.me().catch(() => null);

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit,
        offset: 0,
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

    // 4. Dedup against already-imported messages by GUID.
    const guids = candidates.map((c) => c.bb_guid);
    const existing = await base44.asServiceRole.entities.IMessage.filter({ bb_guid: { $in: guids } }, '-sent_at', guids.length).catch(() => []);
    const existingGuids = new Set((existing || []).map((e) => e.bb_guid).filter(Boolean));

    const toCreate = candidates.filter((c) => !existingGuids.has(c.bb_guid));

    let imported = 0;
    // Bulk create in chunks of 100.
    for (let i = 0; i < toCreate.length; i += 100) {
      const chunk = toCreate.slice(i, i + 100);
      if (chunk.length === 0) continue;
      await base44.asServiceRole.entities.IMessage.bulkCreate(chunk);
      imported += chunk.length;
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