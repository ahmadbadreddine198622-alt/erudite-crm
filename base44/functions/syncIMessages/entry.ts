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

const INSTANCES = ['bb1', 'bb2'];

function instanceConfig(inst) {
  const serverUrl = (inst === 'bb2'
    ? (Deno.env.get('BB2_URL') || '')
    : (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '')).replace(/\/+$/, '');
  const password = inst === 'bb2'
    ? (Deno.env.get('BB2_PASSWORD') || '')
    : (Deno.env.get('BLUEBUBBLES_PASSWORD') || '');
  return { serverUrl, password };
}

// Sync a single BlueBubbles instance. Returns { instance, scanned, matched, imported, skipped, error }.
async function syncInstance(inst, lookbackDays, limit, addressToLandlord, base44) {
  const { serverUrl, password } = instanceConfig(inst);
  if (!serverUrl || !password) {
    return { instance: inst, scanned: 0, matched: 0, imported: 0, skipped: 0, error: 'server not configured' };
  }

  const afterTs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const queryUrl = `${serverUrl}/api/v1/message/query?password=${encodeURIComponent(password)}`;
  let resp;
  try {
    resp = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify({
        limit,
        with: ['handle', 'chats'],
        sort: 'DESC',
        after: afterTs,
      }),
    });
  } catch (e) {
    return { instance: inst, scanned: 0, matched: 0, imported: 0, skipped: 0, error: `fetch failed: ${e.message}` };
  }

  const raw = await resp.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!resp.ok) {
    return { instance: inst, scanned: 0, matched: 0, imported: 0, skipped: 0, error: `BlueBubbles ${resp.status}: ${raw.slice(0, 200)}` };
  }

  const messages = Array.isArray(data?.data) ? data.data : [];

  const candidates = [];
  for (const m of messages) {
    const guid = m?.guid;
    if (!guid) continue;
    const text = m?.text || '';
    if (!text.trim()) continue;

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
      instance: inst,
    });
  }

  if (candidates.length === 0) {
    return { instance: inst, scanned: messages.length, matched: 0, imported: 0, skipped: 0 };
  }

  // Dedup by GUID — fail CLOSED to avoid duplicate import.
  const guids = candidates.map((c) => c.bb_guid);
  const existingGuids = new Set();
  try {
    for (let i = 0; i < guids.length; i += 200) {
      const slice = guids.slice(i, i + 200);
      const existing = await base44.asServiceRole.entities.IMessage.filter({ bb_guid: { $in: slice } }, '-sent_at', slice.length);
      for (const e of (existing || [])) { if (e.bb_guid) existingGuids.add(e.bb_guid); }
    }
  } catch (dedupErr) {
    return { instance: inst, scanned: messages.length, matched: candidates.length, imported: 0, skipped: 0, error: `dedup failed: ${dedupErr.message}` };
  }

  const toCreate = candidates.filter((c) => !existingGuids.has(c.bb_guid));

  let imported = 0;
  for (let i = 0; i < toCreate.length; i += 100) {
    const chunk = toCreate.slice(i, i + 100);
    if (chunk.length === 0) continue;
    await base44.asServiceRole.entities.IMessage.bulkCreate(chunk);
    imported += chunk.length;
  }

  // Mirror to the unified Message entity (best-effort).
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
    try { await base44.asServiceRole.entities.Message.bulkCreate(chunk); } catch (_) { /* best-effort */ }
  }

  // BRAIN V4 P3 LEARN: inbound replies → outcome ledger (best-effort).
  for (const c of toCreate) {
    if (c.direction !== 'inbound' || !c.landlord_id) continue;
    try {
      await base44.asServiceRole.functions.invoke('recordOutcomeEvent', {
        landlord_id: c.landlord_id,
        kind: 'reply_received',
        channel: 'imessage',
        source_ref: `IMessage:${c.bb_guid}`,
        text: c.body || '',
        responded_at: c.sent_at,
      }).catch(() => {});
    } catch (_) { /* best-effort */ }
  }

  return { instance: inst, scanned: messages.length, matched: candidates.length, imported, skipped: candidates.length - toCreate.length };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const lookbackDays = Number(body.lookback_days) > 0 ? Number(body.lookback_days) : 30;
    const limit = Number(body.limit) > 0 ? Math.min(Number(body.limit), 1000) : 500;

    // Which instance(s) to sync: 'bb1', 'bb2', or 'both' (default). The scheduled
    // automation runs with no body, so it syncs BOTH — tolerating either being down.
    let requested = 'both';
    try {
      const qp = new URL(req.url).searchParams.get('instance');
      if (qp === 'bb2' || qp === 'bb1') requested = qp;
      else if (body.instance === 'bb2' || body.instance === 'bb1') requested = body.instance;
    } catch (_) { /* ignore */ }
    const instances = requested === 'both' ? INSTANCES : [requested];

    // Build phone → landlord_id lookup once (shared across instances).
    const landlords = await base44.asServiceRole.entities.Landlord.list('-updated_date', 5000);
    const addressToLandlord = new Map();
    for (const L of landlords) {
      for (const addr of landlordAddresses(L)) {
        if (addr && !addressToLandlord.has(addr)) addressToLandlord.set(addr, L.id);
      }
    }

    const results = [];
    for (const inst of instances) {
      try {
        const r = await syncInstance(inst, lookbackDays, limit, addressToLandlord, base44);
        results.push(r);
      } catch (e) {
        results.push({ instance: inst, scanned: 0, matched: 0, imported: 0, skipped: 0, error: e.message });
      }
    }

    const totalImported = results.reduce((s, r) => s + (r.imported || 0), 0);
    const totalScanned = results.reduce((s, r) => s + (r.scanned || 0), 0);
    const hasError = results.every((r) => r.error);
    const summary = {
      success: !hasError,
      results,
      total_scanned: totalScanned,
      total_imported: totalImported,
    };
    return Response.json(summary, { status: hasError ? 502 : 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});