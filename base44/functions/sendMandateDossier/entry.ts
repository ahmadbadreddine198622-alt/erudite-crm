import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// sendMandateDossier — PHASE 2: ONE-TAP DELIVERY.
//
// Takes a forged MandateDossier (must already have its PDF stored) and delivers it to the
// owner on the chosen channel with the agent-approved cover message. This function does NOT
// talk to WhatsApp/BlueBubbles/Telegram/Gmail itself — it routes through the four existing,
// battle-tested channel senders so every rule they enforce (bb1/bb2 identity routing, Meta vs
// personal line selection, Telegram chat resolution, Gmail OAuth + branded signature, message
// logging, AI-provenance tracking) applies to dossier sends automatically:
//
//   whatsapp → sendMultiChannelWhatsApp  (landlord_id + attachment_url, channel personal|business)
//   imessage → sendIMessage              (landlord_id + attachment {file_url,file_name,media_type})
//   telegram → sendTelegram              (landlord_id + attachment_url/_name/_media_type)
//   email    → sendLandlordEmail         (to + subject + body_html + attachments[{url,filename,mime}])
//
// On confirmed success the dossier record flips to status 'sent' with sent_at + sent_channel —
// the Phase-2 tracking fields created for exactly this.

const clean = (v) => (v == null ? '' : String(v).trim());
const CHANNELS = ['whatsapp', 'imessage', 'telegram', 'email'];

const EMAIL_SUBJECT = {
  en: (unit) => `Mandate Dossier — ${unit}`.trim(),
  ru: (unit) => `Досье собственника — ${unit}`.trim(),
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function textToHtml(s) {
  return String(s || '').split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('');
}

// The channel senders return slightly different success shapes — normalize defensively.
function unwrap(res) { return res && typeof res === 'object' && 'data' in res ? res.data : res; }
function failedReason(r) {
  if (!r || typeof r !== 'object') return 'no response from channel sender';
  if (r.error) return String(r.error);
  if (r.ok === false) return String(r.message || 'channel sender reported failure');
  if (r.success === false) return String(r.message || 'channel sender reported failure');
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dossier_id = clean(body?.dossier_id);
    const channel = clean(body?.channel).toLowerCase();
    const cover_message = clean(body?.cover_message);
    if (!dossier_id) return Response.json({ ok: false, error: 'dossier_id required' }, { status: 400 });
    if (!CHANNELS.includes(channel)) return Response.json({ ok: false, error: `channel must be one of ${CHANNELS.join(', ')}` }, { status: 400 });
    if (!cover_message) return Response.json({ ok: false, error: 'cover_message required — the owner never receives a bare file' }, { status: 400 });

    const svc = base44.asServiceRole;
    const dossier = await svc.entities.MandateDossier.get(dossier_id).catch(() => null);
    if (!dossier) return Response.json({ ok: false, error: 'dossier not found' }, { status: 404 });
    if (!dossier.pdf_url) {
      return Response.json({ ok: false, error: 'dossier has no stored PDF yet — forge it again so the PDF uploads' }, { status: 409 });
    }
    const landlord = await svc.entities.Landlord.get(dossier.landlord_id).catch(() => null);
    if (!landlord) return Response.json({ ok: false, error: 'landlord not found for this dossier' }, { status: 404 });

    const fileName = dossier.file_name || `Mandate_Dossier_v${dossier.version || 1}.pdf`;
    const aiCover = clean(dossier?.narrative?.send_cover_message);
    const provenance = {
      created_from_ai: true,
      ai_source: 'mandateDossier',
      ai_draft_text: aiCover || null,
      was_edited_after_draft: !!aiCover && aiCover !== cover_message,
      ai_disposition: !aiCover ? null : (aiCover === cover_message ? 'accepted' : 'edited'),
    };

    let result = null;
    if (channel === 'whatsapp') {
      const waChannel = clean(body?.whatsapp_channel).toLowerCase() === 'business' ? 'business' : 'personal';
      result = unwrap(await base44.functions.invoke('sendMultiChannelWhatsApp', {
        landlord_id: landlord.id,
        text: cover_message,
        channel: waChannel,
        attachment_url: dossier.pdf_url,
        attachment_name: fileName,
        attachment_media_type: 'document',
        ...provenance,
      }));
    } else if (channel === 'imessage') {
      result = unwrap(await base44.functions.invoke('sendIMessage', {
        landlord_id: landlord.id,
        text: cover_message,
        attachment: { file_url: dossier.pdf_url, file_name: fileName, media_type: 'document' },
      }));
    } else if (channel === 'telegram') {
      result = unwrap(await base44.functions.invoke('sendTelegram', {
        landlord_id: landlord.id,
        text: cover_message,
        attachment_url: dossier.pdf_url,
        attachment_name: fileName,
        attachment_media_type: 'document',
      }));
    } else if (channel === 'email') {
      const to = clean(landlord.email);
      if (!to) return Response.json({ ok: false, error: 'landlord has no email on file', fallback: 'whatsapp' }, { status: 409 });
      const lang = dossier.language === 'ru' ? 'ru' : 'en';
      const unitBits = [dossier?.data_snapshot?.unit?.project_name, dossier?.data_snapshot?.unit?.unit_reference].filter(Boolean).join(' · ') || 'your property';
      result = unwrap(await base44.functions.invoke('sendLandlordEmail', {
        to,
        subject: EMAIL_SUBJECT[lang](unitBits),
        body_html: textToHtml(cover_message),
        landlord_id: landlord.id,
        attachments: [{ url: dossier.pdf_url, filename: fileName, mime: 'application/pdf' }],
      }));
    }

    const reason = failedReason(result);
    if (reason) {
      return Response.json({ ok: false, error: reason, fallback: result?.fallback || null }, { status: 502 });
    }

    const nowIso = new Date().toISOString();
    await svc.entities.MandateDossier.update(dossier_id, {
      status: 'sent',
      sent_at: nowIso,
      sent_channel: channel,
    });

    return Response.json({ ok: true, channel, sent_at: nowIso, dossier_id, file_name: fileName });
  } catch (error) {
    console.error('sendMandateDossier error:', error);
    return Response.json({ ok: false, error: String((error as Error)?.message || error) }, { status: 500 });
  }
});
