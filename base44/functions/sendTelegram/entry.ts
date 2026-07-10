import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// sendTelegram — send a Telegram message to a landlord via the Telegram Bot API.
//
// Telegram requires the recipient to have started a chat with your bot first; we address
// by their numeric chat_id (stored on Landlord.telegram_chat_id). Mirrors sendIMessage:
// single chokepoint, appends the plain-text signature here, sends the branded banner on
// the first outbound message to a chat. Logs to TelegramMessage + the unified Message stream.
//
// Input (JSON): { landlord_id?, chat_id?, text, skip_signature? }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id, text } = body;
    let chatId = body.chat_id;
    const attachment_url = body.attachment_url || null;
    const attachment_name = body.attachment_name || 'attachment';
    const attachmentMediaType = body.attachment_media_type || 'document';

    // Text may be empty when sending a media-only message (caption is optional).
    if ((!text || !String(text).trim()) && !attachment_url) {
      return Response.json({ error: 'Message text or attachment is required' }, { status: 400 });
    }

    // Resolve the destination chat_id: explicit > landlord.telegram_chat_id.
    let landlord = null;
    if (landlord_id) {
      landlord = await base44.entities.Landlord.get(landlord_id).catch(() => null);
      if (!chatId && landlord) chatId = landlord.telegram_chat_id;
    }
    if (!chatId) {
      return Response.json({
        error: 'No Telegram chat for this landlord — they must message the bot first.',
        fallback: 'whatsapp',
      }, { status: 409 });
    }
    chatId = String(chatId).trim();

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    if (!token) {
      return Response.json({ error: 'Telegram bot is not configured' }, { status: 500 });
    }

    // Pull the plain-text signature + banner URL from CompanySettings (single source of truth).
    let signatureText = '';
    let bannerUrl = '';
    try {
      const settings = await base44.asServiceRole.entities.CompanySettings.list('', 1);
      signatureText = settings?.[0]?.telegram_signature_text || settings?.[0]?.imessage_signature_text || '';
      bannerUrl = settings?.[0]?.signature_banner_url || '';
    } catch (_) { /* signature/banner are best-effort */ }

    // Append the signature on agent-composed sends (default). Guard against double-stamping.
    let messageBody = String(text);
    if (signatureText && !body.skip_signature && !messageBody.trimEnd().endsWith(signatureText.trimEnd())) {
      messageBody = messageBody.trimEnd() + '\n\n' + signatureText;
    }

    // First-contact detection: send the branded banner only on the FIRST outbound message to this chat.
    let isFirstContact = false;
    if (bannerUrl && !body.skip_signature) {
      try {
        const prior = await base44.asServiceRole.entities.TelegramMessage.filter(
          { chat_id: chatId, direction: 'outbound' }, '-sent_at', 1
        );
        isFirstContact = !prior || prior.length === 0;
      } catch (_) { isFirstContact = false; }
    }

    // Telegram Bot API: send media when an attachment is present, otherwise plain text.
    let resp;
    if (attachment_url) {
      const isImage = attachmentMediaType === 'image';
      const endpoint = isImage ? 'sendPhoto' : 'sendDocument';
      const mediaKey = isImage ? 'photo' : 'document';
      const mediaResp = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          [mediaKey]: attachment_url,
          caption: messageBody || undefined,
          parse_mode: undefined,
        }),
      });
      resp = mediaResp;
    } else {
      resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: messageBody }),
      });
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      return Response.json({
        error: 'Telegram send failed',
        status: resp.status,
        detail: data?.description || 'unknown error',
      }, { status: 502 });
    }

    // First-contact: send the branded banner as a photo (best-effort — never blocks the text response).
    let bannerSent = false;
    if (isFirstContact && bannerUrl) {
      try {
        const photoResp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, photo: bannerUrl }),
        });
        bannerSent = photoResp.ok;
      } catch (_) { bannerSent = false; }
    }

    const nowIso = new Date().toISOString();
    const tgMessageId = data?.result?.message_id ? String(data.result.message_id) : null;

    // Log to the conversation stream (best-effort).
    let logged = false;
    if (landlord_id) {
      try {
        await base44.entities.TelegramMessage.create({
          landlord_id,
          direction: 'outbound',
          chat_id: chatId,
          body: messageBody,
          status: 'sent',
          sent_at: nowIso,
          agent_email: user.email || null,
          tg_message_id: tgMessageId,
        });
        logged = true;
      } catch (_) { logged = false; }
      // Mirror into the unified Message entity so landlordOrchestrator sees outbound Telegram messages.
      try {
        await base44.asServiceRole.entities.Message.create({
          landlord_id,
          phone: chatId,
          direction: 'outgoing',
          text: messageBody,
          timestamp: nowIso,
          status: 'sent',
          channel: 'telegram',
          wa_message_id: tgMessageId || undefined,
        });
      } catch (_) { /* best-effort mirror */ }
    }

    return Response.json({ success: true, chat_id: chatId, logged, bannerSent, firstContact: isFirstContact, tg_message_id: tgMessageId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});