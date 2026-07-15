import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * recordOutcomeEvent — BRAIN V4 P3 LEARN, the Outcome Ledger writer.
 *
 * The single shared write path for OutcomeEvent rows (append-only ground truth of what
 * actually happened). Invoked fire-and-forget (`svc.functions.invoke('recordOutcomeEvent',
 * ...).catch(...)`) from:
 *   - the five send functions (sendMultiChannelWhatsApp, sendIMessage, sendTelegramMessage,
 *     twilioSendSMS, sendLandlordEmail)               → kind: 'draft_sent'
 *   - the inbound webhooks (evolutionWebhook, metaWhatsAppWebhook, telegramWebhook,
 *     handleGmailWebhook, syncIMessages, twilioWebhook) → kind: 'reply_received'
 *   - processCallQualifications                        → kind: 'qualification_logged'
 *   - parseFormA                                       → kind: 'mandate_signed' / 'mandate_lost'
 *   - the Aurora-proposes strip (P4 ACT)               → kind: 'proposal_approved' / 'proposal_dismissed'
 *   - backfillOutcomeEvents / compileBrainPriors sweeps (backfilled/derived rows)
 *
 * What it adds on top of a bare create:
 *   1. IDEMPOTENCY — dedupe by (kind, source_ref); a second invoke with the same source row
 *      no-ops. Additionally, draft_sent events dedupe by same-landlord+channel+same-text
 *      within 10 minutes (the iMessage composer fans one logical send out across handles).
 *   2. DRAFT ATTRIBUTION — for draft_sent: matches the sent text against the landlord's
 *      forged drafts (ai_approach_drafts, per channel) and the orchestrator's
 *      ai_suggested_messages; stamps angle_used / mode / situation so reply rates can be
 *      compiled per angle. Signature/CTA suffixes appended by senders are tolerated
 *      (containment matching, not equality).
 *   3. REPLY LINKING — for reply_received: finds the most recent draft_sent OutcomeEvent on
 *      the same landlord+channel within 72h, links it (linked_event_id), computes
 *      latency_hours, and inherits its angle/mode/situation/template_key so the reply
 *      carries the attribution of the outbound it answers. Falls back to the channel's own
 *      message table when no ledger event exists (pre-V4 history).
 *   4. ENRICHMENT — snapshots landlord_archetype / project_name / nationality / stage and
 *      hour_dubai (Asia/Dubai = UTC+4) onto the event so the ledger is self-contained for
 *      compileBrainPriors.
 *
 * Degrade-safe: every read .catch(() => null/[]); any enrichment failure still records the
 * bare event. `dry_run: true` returns the fully-built event without creating it (used for
 * verification). This function NEVER sends anything and NEVER writes any entity other than
 * OutcomeEvent.
 */

const CHANNELS = ['whatsapp', 'imessage', 'telegram', 'sms', 'email', 'call', 'other'];
const KINDS = [
  'draft_sent', 'reply_received', 'call_connected', 'qualification_logged',
  'appointment_kept', 'appointment_noshow', 'mandate_signed', 'mandate_lost',
  'listing_published', 'deal_closed', 'went_dark', 'proposal_approved', 'proposal_dismissed'
];
const REPLY_WINDOW_HOURS = 72;

// Normalize text for draft matching: lowercase, strip everything but letters/digits
// (works across scripts — Arabic/Cyrillic letters survive \p{L}).
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Containment-based match: the sender may append a signature/CTA to the draft, or truncate
// it (SMS). A real load-then-send keeps the draft body intact inside the sent text, so
// containment either direction (on ≥40 normalized chars) is a reliable, cheap signal.
// Falls back to a 120-char prefix comparison for lightly-edited drafts.
function textsMatch(sentText, draftText) {
  const a = norm(sentText);
  const b = norm(draftText);
  if (!a || !b) return false;
  if (a.length >= 40 && b.length >= 40) {
    if (a.includes(b) || b.includes(a)) return true;
    if (a.slice(0, 120) === b.slice(0, 120)) return true;
  } else if (a === b) {
    return true;
  }
  return false;
}

const hourDubai = (iso) => {
  const t = new Date(iso || Date.now());
  if (isNaN(t)) return null;
  return (t.getUTCHours() + 4) % 24; // Asia/Dubai = UTC+4, no DST
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Callers are other functions (service role) or the logged-in UI; scheduled/service
    // invocations have no user — proceed with service role either way (write-only, internal).
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const {
      landlord_id = null,
      kind,
      channel = 'other',
      source_ref = '',
      text = '',
      sent_at = null,
      responded_at = null,
      writer_email = null,
      ai_source = null,
      ai_draft_text = null,
      template_key = null,
      backfilled = false,
      dry_run = false,
      description = ''
    } = body || {};

    if (!kind || !KINDS.includes(kind)) {
      return Response.json({ ok: false, error: `kind required, one of: ${KINDS.join(', ')}` }, { status: 400 });
    }
    if (!landlord_id) {
      // The ledger is landlord-scoped. Lead-only events (e.g. lead SMS) are out of scope — no-op
      // by design so senders can invoke unconditionally.
      return Response.json({ ok: true, skipped: 'no_landlord_id' });
    }
    const chan = CHANNELS.includes(channel) ? channel : 'other';

    // ── 1. IDEMPOTENCY ──
    if (source_ref) {
      const dupe = await svc.entities.OutcomeEvent.filter({ kind, source_ref }, '-created_date', 1).catch(() => []);
      if (Array.isArray(dupe) && dupe.length) {
        return Response.json({ ok: true, deduped: 'source_ref', event_id: dupe[0].id });
      }
    }

    const whenIso = kind === 'reply_received'
      ? (responded_at || new Date().toISOString())
      : (sent_at || new Date().toISOString());

    // Multi-handle fan-out guard: one logical send = one draft_sent event even when the
    // composer loops over several handles (iMessage sends once per confirmed handle). A twin
    // = same landlord + channel + identical text fingerprint within 10 minutes.
    const textHead = norm(text).slice(0, 120);
    if (kind === 'draft_sent' && textHead) {
      const recent = await svc.entities.OutcomeEvent.filter(
        { landlord_id, kind: 'draft_sent', channel: chan }, '-created_date', 5
      ).catch(() => []);
      const tenMinAgo = new Date(whenIso).getTime() - 10 * 60 * 1000;
      const twin = (Array.isArray(recent) ? recent : []).find((e) =>
        e && e.sent_at && new Date(e.sent_at).getTime() >= tenMinAgo &&
        e.text_head && e.text_head === textHead
      );
      if (twin) {
        return Response.json({ ok: true, deduped: 'fanout_window', event_id: twin.id });
      }
    }

    // ── 4. ENRICHMENT (fetch landlord once; also used for draft attribution) ──
    const landlord = await svc.entities.Landlord.get(landlord_id).catch(() => null);

    const event = {
      landlord_id,
      kind,
      channel: chan,
      angle_used: '',
      mode: '',
      situation: '',
      writer_email: writer_email || user?.email || '',
      source_ref: source_ref || '',
      template_key: template_key || '',
      landlord_archetype: landlord?.landlord_archetype || '',
      project_name: landlord?.project_name || '',
      nationality: landlord?.nationality || '',
      stage: landlord?.stage || '',
      hour_dubai: hourDubai(whenIso),
      text_head: textHead,
      backfilled: !!backfilled,
      description: String(description || '').slice(0, 1000)
    };
    if (kind === 'reply_received') event.responded_at = whenIso;
    else event.sent_at = whenIso;

    // ── 2. DRAFT ATTRIBUTION (draft_sent only) ──
    if (kind === 'draft_sent' && landlord) {
      try {
        const drafts = landlord.ai_approach_drafts;
        const channelDraft = drafts && typeof drafts === 'object' ? drafts[chan] : null;
        const draftBody = channelDraft?.body_native || '';
        const uiSaysDraft = (ai_source === 'forgeApproachDrafts') ||
          (typeof ai_draft_text === 'string' && ai_draft_text.trim() && textsMatch(text, ai_draft_text));
        if (draftBody && text && textsMatch(text, draftBody)) {
          event.angle_used = drafts.angle_used || '';
          event.mode = drafts.mode || '';
          event.situation = drafts.situation || '';
        } else if (uiSaysDraft && drafts && typeof drafts === 'object') {
          // UI attests a forge draft was loaded (possibly edited past containment) — trust it.
          event.angle_used = drafts.angle_used || '';
          event.mode = drafts.mode || '';
          event.situation = drafts.situation || '';
          if (!event.description) event.description = 'ui_attested_draft';
        } else if (text && Array.isArray(landlord.ai_suggested_messages)) {
          const hit = landlord.ai_suggested_messages.find((m) => m && m.text && textsMatch(text, m.text));
          if (hit) {
            event.angle_used = 'orchestrator_suggested';
            event.mode = hit.mode || '';
          }
        }
      } catch (_) { /* attribution is best-effort */ }
    }

    // ── 3. REPLY LINKING (reply_received only) ──
    if (kind === 'reply_received') {
      try {
        const windowStart = new Date(whenIso).getTime() - REPLY_WINDOW_HOURS * 3.6e6;
        const priorSends = await svc.entities.OutcomeEvent.filter(
          { landlord_id, kind: 'draft_sent', channel: chan }, '-sent_at', 1
        ).catch(() => []);
        const lastSend = Array.isArray(priorSends) ? priorSends[0] : null;
        if (lastSend?.sent_at) {
          const sentTs = new Date(lastSend.sent_at).getTime();
          if (sentTs >= windowStart && sentTs <= new Date(whenIso).getTime()) {
            event.linked_event_id = lastSend.id;
            event.latency_hours = Math.round(((new Date(whenIso).getTime() - sentTs) / 3.6e6) * 10) / 10;
            // The reply inherits the attribution of the outbound it answers — this is what
            // makes per-angle reply rates compilable.
            event.angle_used = lastSend.angle_used || '';
            event.mode = lastSend.mode || '';
            event.situation = lastSend.situation || '';
            event.template_key = lastSend.template_key || event.template_key;
          }
        }
        if (!event.linked_event_id) {
          // Pre-V4 history fallback: last outbound in the channel's own table.
          const lastOutboundTs = await lastOutboundFromChannelTable(svc, landlord_id, chan);
          if (lastOutboundTs && lastOutboundTs >= windowStart && lastOutboundTs <= new Date(whenIso).getTime()) {
            event.latency_hours = Math.round(((new Date(whenIso).getTime() - lastOutboundTs) / 3.6e6) * 10) / 10;
          }
        }
      } catch (_) { /* linking is best-effort */ }
    }

    if (dry_run) return Response.json({ ok: true, dry_run: true, event });

    const created = await svc.entities.OutcomeEvent.create(event);
    return Response.json({ ok: true, event_id: created?.id || null });
  } catch (error) {
    console.error('recordOutcomeEvent error:', error);
    return Response.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
});

// Last outbound timestamp (ms) for a landlord on a channel, from the channel's own table.
// Used only as a pre-V4 fallback for latency when no ledger event exists yet.
async function lastOutboundFromChannelTable(svc, landlord_id, chan) {
  try {
    if (chan === 'whatsapp') {
      const rows = await svc.entities.Message.filter({ landlord_id, direction: 'outgoing' }, '-timestamp', 5).catch(() => []);
      const r = (Array.isArray(rows) ? rows : []).find((m) => m && m.channel !== 'imessage' && m.channel !== 'email');
      return r?.timestamp ? new Date(r.timestamp).getTime() : null;
    }
    if (chan === 'imessage') {
      const rows = await svc.entities.IMessage.filter({ landlord_id, direction: 'outbound' }, '-sent_at', 1).catch(() => []);
      return rows?.[0]?.sent_at ? new Date(rows[0].sent_at).getTime() : null;
    }
    if (chan === 'telegram') {
      const rows = await svc.entities.TelegramMessage.filter({ landlord_id, direction: 'outbound' }, '-sent_at', 1).catch(() => []);
      return rows?.[0]?.sent_at ? new Date(rows[0].sent_at).getTime() : null;
    }
    if (chan === 'email') {
      const rows = await svc.entities.Email.filter({ landlord_id, direction: 'outbound' }, '-received_at', 1).catch(() => []);
      return rows?.[0]?.received_at ? new Date(rows[0].received_at).getTime() : null;
    }
    return null;
  } catch (_) { return null; }
}
