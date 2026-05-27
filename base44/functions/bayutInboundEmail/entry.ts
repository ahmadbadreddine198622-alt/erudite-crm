import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Inbound email webhook for Bayut leads (when integration_mode = "email_forward").
 *
 * Setup: in Bayut dashboard, set lead notification email to the
 * BayutCredential.lead_forward_address. Configure your inbound-email
 * provider (Postmark, SendGrid Inbound Parse, Mailgun Routes) to POST
 * here on each new email.
 *
 * Body shape (Postmark example): { From, Subject, TextBody, HtmlBody, MessageID }
 * We parse the Bayut email body for phone/email/property reference and create a Lead.
 */

const PHONE_RE = /(\+?\d[\d\s\-()]{7,15}\d)/g;
const EMAIL_RE = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
const PROPERTY_REF_RE = /(?:Property|Listing|Ref(?:erence)?)[\s#:]*([A-Za-z0-9\-]{4,})/i;
const NAME_RE = /Name[\s:]+([A-Za-z؀-ۿ .\-']{2,50})/i;
const BUDGET_RE = /(?:Budget|Price)[\s:]+(?:AED\s?)?([\d,]+)/i;
const LOCATION_RE = /(?:Location|Area|Community)[\s:]+([A-Za-z؀-ۿ .\-,]{2,80})/i;

function firstMatch(regex: RegExp, text: string): string | null {
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let c = raw.replace(/[^\d+]/g, '');
  if (!c) return null;
  if (c.startsWith('+')) return c;
  if (c.startsWith('00')) return '+' + c.slice(2);
  if (c.startsWith('05') && c.length === 10) return '+971' + c.slice(1);
  if (c.startsWith('5') && c.length === 9) return '+971' + c;
  if (c.length >= 10) return '+' + c;
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Tolerate Postmark + SendGrid + Mailgun shapes
    const fromEmail = body.From || body.from || body.sender;
    const subject = body.Subject || body.subject || '';
    const text = body.TextBody || body['body-plain'] || body.text || body.HtmlBody?.replace(/<[^>]+>/g, ' ') || '';
    const messageId = body.MessageID || body['Message-Id'] || body['message-id'];

    if (!text) return Response.json({ error: 'empty body' }, { status: 400 });

    // Validate it actually came from Bayut
    if (!/(bayut|emails\.bayut\.com)/i.test(fromEmail || '')) {
      return Response.json({ ignored: 'not_from_bayut' });
    }

    const phone = normalizePhone(firstMatch(PHONE_RE, text) || '');
    const email = firstMatch(EMAIL_RE, text);
    const name = firstMatch(NAME_RE, text) || 'Bayut Lead';
    const propertyRef = firstMatch(PROPERTY_REF_RE, text);
    const budgetStr = firstMatch(BUDGET_RE, text);
    const location = firstMatch(LOCATION_RE, text);
    const budget = budgetStr ? parseInt(budgetStr.replace(/,/g, ''), 10) : null;

    if (!phone && !email) {
      return Response.json({ ignored: 'no_contact_method', subject });
    }

    const cred = (await base44.asServiceRole.entities.BayutCredential.list())?.[0];

    // Dedupe
    const existing = await base44.asServiceRole.entities.Lead.filter({
      $or: [
        phone ? { phone, source: 'bayut' } : null,
        email ? { email, source: 'bayut' } : null
      ].filter(Boolean) as any
    });

    if (existing?.[0]) {
      await base44.asServiceRole.entities.Lead.update(existing[0].id, {
        last_contact_date: new Date().toISOString(),
        notes: (existing[0].notes || '') + `\n\n[${new Date().toISOString()}] New Bayut inquiry: ${subject}\n${text.slice(0, 500)}`
      });
      return Response.json({ ok: true, action: 'updated', lead_id: existing[0].id });
    }

    const lead = await base44.asServiceRole.entities.Lead.create({
      name,
      phone,
      email,
      source: 'bayut',
      source_reference: propertyRef,
      budget_aed: budget,
      preferred_locations: location ? [location] : [],
      stage: 'new',
      assigned_agent_email: cred?.default_agent_email,
      notes: `Bayut inquiry via email\nSubject: ${subject}\n\n${text.slice(0, 1000)}`,
      created_date: new Date().toISOString()
    });

    try {
      await base44.asServiceRole.entities.Activity.create({
        lead_id: lead.id,
        type: 'note',
        title: `Bayut inquiry (email): ${subject || 'no subject'}`,
        description: text.slice(0, 2000),
        source: 'bayut',
        metadata: { email_message_id: messageId, property_ref: propertyRef }
      });
    } catch (_) { /* non-fatal */ }

    return Response.json({ ok: true, action: 'created', lead_id: lead.id });
  } catch (error: any) {
    console.error('bayutInboundEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
