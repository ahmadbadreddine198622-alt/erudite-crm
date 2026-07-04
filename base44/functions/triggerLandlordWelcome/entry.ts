// triggerLandlordWelcome — fires on new Landlord creation (entity automation).
// Sends the 3 WhatsApp welcome messages + welcome email using templates
// stored in MessageTemplate (category='welcome_sequence'), so all content
// is editable from the Automations Hub — never hard-coded.
//
// Triggered by: entity automation on Landlord create.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    const landlord = data;

    if (!landlord || !landlord.id) {
      return Response.json({ status: 'skipped', reason: 'no_landlord' });
    }
    if (!landlord.phone && !landlord.whatsapp) {
      return Response.json({ status: 'skipped', reason: 'no_phone' });
    }

    // ── Look up welcome templates ──────────────────────────────────────
    const templates = await base44.asServiceRole.entities.MessageTemplate.filter(
      { category: 'welcome_sequence', is_active: true },
      'sort_order',
      20
    );

    if (!templates || templates.length === 0) {
      return Response.json({ status: 'skipped', reason: 'no_welcome_templates' });
    }

    // ── Resolve agent name ─────────────────────────────────────────────
    const agentEmail = landlord.assigned_agent_email || '';
    let agentName = 'Ahmad Badreddine';
    if (agentEmail) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: agentEmail });
        if (users && users.length > 0) {
          agentName = users[0].full_name || agentName;
        }
      } catch (_) { /* best-effort */ }
    }
    const landlordName = landlord.full_name_en || landlord.full_name_ar || 'there';
    const landlordPhone = (landlord.phone || landlord.whatsapp || '').replace(/[^0-9]/g, '');
    const landlordEmail = landlord.email || null;

    // ── Send WhatsApp messages ─────────────────────────────────────────
    const waTemplates = templates.filter((t) => t.channel === 'whatsapp');
    const evoUrl = Deno.env.get('EVOLUTION_API_URL');
    const evoKey = Deno.env.get('EVOLUTION_API_KEY');
    const evoInstance = Deno.env.get('EVOLUTION_INSTANCE');

    let waSent = 0;
    for (const tpl of waTemplates) {
      const text = (tpl.body || '')
        .replace(/\{\{landlord_name\}\}/g, landlordName)
        .replace(/\{\{agent_name\}\}/g, agentName);

      try {
        if (evoUrl && evoKey && evoInstance) {
          await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: landlordPhone, text }),
          });
        }
        waSent++;
        // Increment usage count
        await base44.asServiceRole.entities.MessageTemplate.update(tpl.id, {
          usage_count: (tpl.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        }).catch(() => null);
        // 5-second gap between messages
        if (waTemplates.indexOf(tpl) < waTemplates.length - 1) {
          await sleep(5000);
        }
      } catch (_) { /* best-effort per message */ }
    }

    // ── Send welcome email ─────────────────────────────────────────────
    let emailSent = false;
    const emailTpl = templates.find((t) => t.channel === 'email');
    if (emailTpl && landlordEmail) {
      try {
        const emailBody = (emailTpl.body || '')
          .replace(/\{\{landlord_name\}\}/g, landlordName)
          .replace(/\{\{agent_name\}\}/g, agentName);

        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

        function toBase64Url(str) {
          const bytes = new TextEncoder().encode(str);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }

        const mime = [
          `From: ${agentEmail || 'ahmad@erudite-estate.com'}`,
          `To: ${landlordEmail}`,
          `Subject: ${emailTpl.subject || 'Welcome to Erudite Real Estate'}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset="UTF-8"',
          '',
          emailBody.replace(/\n/g, '<br/>'),
        ].join('\r\n');

        await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: toBase64Url(mime) }),
        });
        emailSent = true;

        await base44.asServiceRole.entities.MessageTemplate.update(emailTpl.id, {
          usage_count: (emailTpl.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        }).catch(() => null);
      } catch (_) { /* best-effort */ }
    }

    return Response.json({
      status: 'sent',
      landlord_id: landlord.id,
      whatsapp_sent: waSent,
      email_sent: emailSent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});