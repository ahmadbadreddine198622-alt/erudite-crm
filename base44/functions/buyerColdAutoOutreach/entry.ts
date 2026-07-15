import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * buyerColdAutoOutreach — the buyer-side cold-outreach branch (twin of winBranchAutoOutreach,
 * BUYER BRAIN V1 B1.5d). For every lead sitting in an ENTRY stage (intake_clarify /
 * contact_identity / new_tenant_lead) with a phone and NO outbound message ever sent on any
 * channel, it:
 *   1. drafts a personalized, search-aware WhatsApp cold-open (Claude Haiku cold tier,
 *      tool-forced structured output, voiced as the calling agent),
 *   2. — ONLY when a human explicitly passes send:true with dry_run:false — sends it via the
 *      existing user-scoped sendWhatsAppMessageFromCRM function and logs a WhatsApp Activity.
 *
 * DELIBERATE DIVERGENCES from the landlord twin (buyer-brain covenant):
 *   - dry_run defaults to TRUE — drafts first, always; sending requires the human to flip it.
 *   - NO stage writes — the buyer brain never touches Lead.stage (and the buyer tracks have
 *     no 'attempted_to_contact' stage). The orchestrator recommends; a human moves stages.
 *   - QUIET HOURS: sends are blocked 21:00-09:00 Asia/Dubai (drafts are allowed anytime).
 *
 * Runs in small batches (default 8, max 25) to stay well under the function timeout and to
 * let the UI pace the run. Admin-only.
 */

const COLD_MODEL = 'claude-haiku-4-5-20251001';
const ENTRY_STAGES = ['intake_clarify', 'contact_identity', 'new_tenant_lead'];

// KEEP IN SYNC with buyerOrchestrator's buildWriter/CEO_EMAILS (identity engine).
const CEO_EMAILS = ['ahmad.badreddine198622@gmail.com', 'ahmad@erudite-estate.com'];

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string', description: "The WhatsApp cold-open, 2-3 sentences, max ~320 characters, entirely in the lead's preferred language." },
  },
  required: ['message'],
};

function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}

function dubaiHour() {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date()));
  } catch (_) { return 12; }
}

async function draftColdOpen(anthropic, lead, writerName, writerPosition) {
  const isRent = lead.intent === 'tenant';
  const language = lead.preferred_language || 'en';
  const budget = (lead.budget_min || lead.budget_max)
    ? `AED ${(lead.budget_min || 0).toLocaleString()} - ${(lead.budget_max || 0).toLocaleString()}${isRent ? ' per year (ANNUAL RENT)' : ''}`
    : null;
  const search = [
    budget ? `budget ${budget}` : null,
    (lead.bedrooms_min != null || lead.bedrooms_max != null) ? `${lead.bedrooms_min ?? '?'}-${lead.bedrooms_max ?? '?'} BR` : null,
    (Array.isArray(lead.preferred_locations) && lead.preferred_locations.length) ? `areas: ${lead.preferred_locations.join(', ')}` : null,
    lead.move_in_timeline ? `timeline: ${lead.move_in_timeline}` : null,
  ].filter(Boolean).join(' · ');

  const prompt = `Write ONE short WhatsApp first-contact message (2-3 sentences, max ~320 characters) from ${writerName}, ${writerPosition} at Erudite Real Estate, Dubai, to a ${isRent ? 'prospective TENANT (renting, money = annual rent — never talk buying)' : lead.intent === 'buyer' ? 'prospective property BUYER' : 'new property lead (do NOT assume buying vs renting — you may gently ask which)'}.
Write ENTIRELY in the lead's preferred language (language code: ${language}). Do not mix languages.
Be warm, personal, and senior. ${search ? `Reference their stated search naturally to prove we read their inquiry: ${search}.` : `Their inquiry came in via ${lead.source || 'our channels'} with no stated criteria yet — open by asking ONE smart, easy question about what they are looking for.`}
Ask ONE easy question. Do NOT mention commission or fees. No exclamation marks. No emojis. No links. End with a soft sign-off naming ${writerName.split(' ')[0]}.
NEVER invent a listing, price, or market figure.`;

  const response = await anthropic.messages.create({
    model: COLD_MODEL,
    max_tokens: 512,
    system: 'You draft one short, senior, personal WhatsApp cold-open for a Dubai real-estate lead. Emit via the tool only.',
    messages: [{ role: 'user', content: prompt }],
    tools: [{ name: 'emit_cold_open', description: 'Emit the drafted WhatsApp message.', input_schema: DRAFT_SCHEMA }],
    tool_choice: { type: 'tool', name: 'emit_cold_open' },
  });
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  const msg = toolBlock?.input?.message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Admin-only for humans; the platform service account (function-to-function invokes,
    // e.g. probeRunBrain diagnostics — an internal-only path) is allowed and can only dry-run
    // meaningfully since sends go out on the CALLER's user-scoped WhatsApp line.
    const isServiceCaller = String(user.email || '').toLowerCase().includes('no-reply.base44.com');
    if (!isServiceCaller && user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const {
      intent,                 // optional: 'buyer' | 'tenant' — restrict the track
      source,                 // optional: restrict to one lead source
      lead_ids,               // optional: explicit allowlist (e.g. the filtered board subset)
      limit = 8,
      send = false,           // sends happen ONLY when a human passes send:true AND dry_run:false
      dry_run = true,         // covenant default: drafts first, always
    } = body;
    const maxN = Math.min(Math.max(1, Number(limit) || 8), 25);
    const sending = send === true && dry_run !== true;

    // QUIET HOURS (Asia/Dubai 21:00-09:00): never blast leads at night. Drafts are fine.
    if (sending) {
      const h = dubaiHour();
      if (h >= 21 || h < 9) {
        return Response.json({
          ok: false, quiet_hours: true,
          error: `Quiet hours (21:00-09:00 Asia/Dubai, now ${String(h).padStart(2, '0')}:xx) — sends are blocked. Run with dry_run to prepare drafts and send after 09:00.`,
        }, { status: 409 });
      }
    }

    // ── Load entry-stage leads ─────────────────────────────────────────────────
    const batches = await Promise.all(ENTRY_STAGES.map((st) =>
      svc.entities.Lead.filter({ stage: st, status: 'active' }, '-created_date', 1000).catch(() => [])
    ));
    let leads = batches.flat().filter((l) => l && l.phone);
    if (intent === 'buyer' || intent === 'tenant') leads = leads.filter((l) => l.intent === intent);
    if (source) leads = leads.filter((l) => l.source === source);
    if (Array.isArray(lead_ids) && lead_ids.length) {
      const allow = new Set(lead_ids.map((id) => String(id)));
      leads = leads.filter((l) => allow.has(String(l.id)));
    }

    if (!leads.length) {
      return Response.json({
        ok: true, processed: 0, sent: 0, skipped: 0, failed: 0,
        remaining: 0, totalQueue: 0, details: [],
        message: 'No entry-stage leads with a phone found for this filter.',
      });
    }

    // ── Never-contacted guard (skip leads with ANY prior outbound on any channel) ─
    const ids = leads.map((l) => l.id);
    const [waOut, msgOut, imOut, tgOut] = await Promise.all([
      svc.entities.WhatsAppMessage.filter({ lead_id: { $in: ids }, direction: 'outbound' }).catch(() => []),
      svc.entities.Message.filter({ lead_id: { $in: ids }, direction: 'outgoing' }).catch(() => []),
      svc.entities.IMessage.filter({ lead_id: { $in: ids }, direction: 'outbound' }).catch(() => []),
      svc.entities.TelegramMessage.filter({ lead_id: { $in: ids }, direction: 'outbound' }).catch(() => []),
    ]);
    const contacted = new Set();
    [...(waOut || []), ...(msgOut || []), ...(imOut || []), ...(tgOut || [])].forEach((m) => {
      if (m && m.lead_id) contacted.add(m.lead_id);
    });
    // Phone-variant outbound check (live WhatsApp rows often carry no lead_id):
    // batched per-lead lookups would explode; instead fetch recent outbound rows once and
    // match by normalized phone suffix.
    const recentWaOut = await svc.entities.WhatsAppMessage.filter({ direction: 'outbound' }, '-timestamp', 2000).catch(() => []);
    const outToDigits = new Set((Array.isArray(recentWaOut) ? recentWaOut : []).map((m) => String(m.to_number || '').replace(/\D/g, '')).filter((d) => d.length >= 9).map((d) => d.slice(-9)));
    const queue = leads.filter((l) => {
      if (contacted.has(l.id)) return false;
      const d = String(l.phone || '').replace(/\D/g, '');
      if (d.length >= 9 && outToDigits.has(d.slice(-9))) return false;
      return true;
    });
    const totalQueue = queue.length;
    if (!totalQueue) {
      return Response.json({
        ok: true, processed: 0, sent: 0, skipped: leads.length, failed: 0,
        remaining: 0, totalQueue: 0, details: [],
        message: 'All entry-stage leads for this filter have already been contacted.',
      });
    }
    const batch = queue.slice(0, maxN);

    // Writer identity — the calling admin's real name/position (CEO voice for CEO accounts).
    const isCEO = CEO_EMAILS.includes(String(user.email || '').toLowerCase());
    const writerName = isCEO ? 'Ahmad Badreddine' : (String(user.display_name || user.full_name || '').trim() || 'your Erudite consultant');
    const writerPosition = isCEO ? 'CEO' : (String(user.position || '').trim() || 'Property Consultant');

    // Service-caller runs (probe diagnostics, crons) must never voice a draft as "Service":
    // per-lead fallback to the ASSIGNED agent's real name (KEEP IN SYNC with the forge twins).
    const agentNameCache = new Map();
    const writerFor = async (lead) => {
      if (!isServiceCaller) return { name: writerName, position: writerPosition };
      const em = String(lead.assigned_agent_email || '').toLowerCase();
      if (!em) return { name: 'your Erudite consultant', position: 'Property Consultant' };
      if (!agentNameCache.has(em)) {
        const u = await svc.entities.User.filter({ email: lead.assigned_agent_email }, '-created_date', 1).then((r) => r?.[0]).catch(() => null);
        const isCeoAgent = CEO_EMAILS.includes(em);
        agentNameCache.set(em, {
          name: isCeoAgent ? 'Ahmad Badreddine' : (String(u?.display_name || u?.full_name || '').trim() || 'your Erudite consultant'),
          position: isCeoAgent ? 'CEO' : (String(u?.position || '').trim() || 'Property Consultant'),
        });
      }
      return agentNameCache.get(em);
    };

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const details = [];
    let sentCount = 0, failedCount = 0;

    for (const lead of batch) {
      const name = lead.full_name || lead.phone || 'Lead';

      let message = null;
      try {
        const w = await writerFor(lead);
        message = await draftColdOpen(anthropic, lead, w.name, w.position);
      } catch (_) { /* fall through to gen_failed */ }

      if (!message) {
        failedCount++;
        details.push({ lead_id: lead.id, name, status: 'gen_failed' });
        continue;
      }

      if (!sending) {
        details.push({ lead_id: lead.id, name, status: 'draft', message });
        continue;
      }

      // Send via the user-scoped send function so it goes out on the admin's WhatsApp line.
      try {
        const e164 = phoneVariants(lead.phone)[0]?.startsWith('+') ? phoneVariants(lead.phone)[0] : '+' + phoneVariants(lead.phone)[0];
        const sendRes = await base44.functions.invoke('sendWhatsAppMessageFromCRM', {
          phone_number: e164,
          message_text: message,
        });
        const sd = sendRes?.data ?? sendRes;
        if (sd && sd.error) throw new Error(sd.error);
        sentCount++;

        // Activity log only — NO stage write (buyer-brain covenant: stages are human-moved).
        try {
          const now = new Date().toISOString();
          await svc.entities.Activity.create({
            lead_id: lead.id,
            type: 'whatsapp',
            title: 'AI cold outreach — first touch sent (human-approved)',
            direction: 'outbound',
            channel: 'whatsapp',
            description: message,
            status: 'completed',
            completed_at: now,
            agent_email: user.email,
            source: 'automation',
          });
        } catch (_) { /* activity log must never block the run */ }

        details.push({ lead_id: lead.id, name, status: 'sent', message });
      } catch (e) {
        failedCount++;
        details.push({ lead_id: lead.id, name, status: 'send_failed', error: String(e?.message || e) });
      }
    }

    return Response.json({
      ok: true,
      dry_run: !sending,
      processed: batch.length,
      sent: sentCount,
      skipped: leads.length - totalQueue,
      failed: failedCount,
      remaining: Math.max(0, totalQueue - batch.length),
      totalQueue,
      details,
    });
  } catch (error) {
    console.error('buyerColdAutoOutreach error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
