import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// sendTelegramMessage — frontend-callable function that sends a Telegram message
// to a landlord via the external Telegram relay.
//
// Input: { landlord_id, body, session_id (optional, default "erudite_main") }
//
// Logic:
//   1. Resolve session_id: caller-provided > current user's connected
//      TelegramSession > "erudite_main" fallback.
//   2. Build the target: { chat_id: landlord.telegram_chat_id } if set, else
//      { phone: landlord.phone } (E.164), else { username: landlord.telegram_username }.
//   3. POST to TELEGRAM_RELAY_URL + "/send" with X-Relay-Secret header and
//      JSON { session_id, to, body }.
//   4. On success: create a TelegramMessage (outbound), save the returned
//      chat_id on the landlord if it was empty. The TelegramMessage record IS
//      the activity/timeline entry (buildLandlordStream reads it directly).
//   5. On relay error: return the error to the caller and create a
//      WebhookDeadLetter record.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json().catch(() => ({}));
    const { landlord_id, body } = input;
    let session_id = input.session_id;

    if (!landlord_id) return Response.json({ error: 'landlord_id is required' }, { status: 400 });
    if (!body || !String(body).trim()) return Response.json({ error: 'body is required' }, { status: 400 });

    // Load landlord
    const landlord = await base44.entities.Landlord.get(landlord_id).catch(() => null);
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    // Resolve session_id: caller-provided > user's connected session > default
    if (!session_id) {
      try {
        const userSessions = await base44.entities.TelegramSession.filter(
          { agent_email: user.email, status: 'connected' }, '-updated_date', 1
        );
        if (userSessions && userSessions.length) {
          session_id = userSessions[0].session_id;
        }
      } catch (_) { /* ignore */ }
      if (!session_id) session_id = 'erudite_main';
    }

    // Build the target
    let to: any = {};
    if (landlord.telegram_chat_id) {
      to = { chat_id: landlord.telegram_chat_id };
    } else if (landlord.phone) {
      to = { phone: landlord.phone };
    } else if (landlord.telegram_username) {
      to = { username: landlord.telegram_username };
    } else {
      return Response.json({ error: 'No Telegram target for this landlord' }, { status: 400 });
    }

    // POST to the relay
    const relayUrl = (Deno.env.get('TELEGRAM_RELAY_URL') || '').replace(/\/$/, '');
    const relaySecret = Deno.env.get('TELEGRAM_RELAY_SECRET') || '';
    if (!relayUrl || !relaySecret) {
      return Response.json({ error: 'Telegram relay not configured' }, { status: 500 });
    }

    const relayResp = await fetch(`${relayUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
      body: JSON.stringify({ session_id, to, body }),
    });
    const relayData = await relayResp.json().catch(() => ({}));

    if (!relayResp.ok || relayData?.error) {
      // Create a WebhookDeadLetter
      try {
        await base44.asServiceRole.entities.WebhookDeadLetter.create({
          source: 'telegram',
          event: 'send',
          stage: 'relay_send',
          error: String(relayData?.error || `Relay returned ${relayResp.status}`).slice(0, 1000),
          raw_payload: { landlord_id, session_id, to, body, relay_response: relayData },
        });
      } catch (_) { /* best-effort */ }
      return Response.json(
        { error: relayData?.error || `Relay returned ${relayResp.status}` },
        { status: 502 }
      );
    }

    const nowIso = new Date().toISOString();
    const returnedChatId = relayData?.chat_id ? String(relayData.chat_id) : (landlord.telegram_chat_id || '');
    const tgMessageId = relayData?.tg_message_id
      ? String(relayData.tg_message_id)
      : relayData?.message_id ? String(relayData.message_id) : null;

    // Create TelegramMessage (outbound) — this IS the activity/timeline entry
    await base44.entities.TelegramMessage.create({
      landlord_id,
      direction: 'outbound',
      chat_id: returnedChatId,
      body: String(body),
      status: 'sent',
      sent_at: nowIso,
      agent_email: user.email || undefined,
      tg_message_id: tgMessageId || undefined,
    });

    // Save chat_id on the landlord if it was empty
    if (!landlord.telegram_chat_id && returnedChatId) {
      try {
        await base44.entities.Landlord.update(landlord_id, { telegram_chat_id: returnedChatId });
      } catch (_) { /* best-effort */ }
    }

    // BRAIN V4 P3 LEARN: outcome ledger (non-fatal, never blocks the send).
    try {
      await base44.asServiceRole.functions.invoke('recordOutcomeEvent', {
        landlord_id,
        kind: 'draft_sent',
        channel: 'telegram',
        source_ref: tgMessageId ? `TelegramMessage:${tgMessageId}` : `TelegramMessage:${landlord_id}:${nowIso}`,
        text: String(body),
        sent_at: nowIso,
        writer_email: user.email || null,
      }).catch(() => {});
    } catch (_) { /* ledger must never break a send */ }

    return Response.json({ success: true, chat_id: returnedChatId, tg_message_id: tgMessageId });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});