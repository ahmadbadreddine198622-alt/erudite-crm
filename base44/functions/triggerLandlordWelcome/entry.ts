// triggerLandlordWelcome — fires on new Landlord creation (entity automation).
// Sends the 3 WhatsApp welcome messages + welcome email using templates
// stored in MessageTemplate (category='welcome_sequence'), so all content
// is editable from the Automations Hub — never hard-coded.
//
// Triggered by: entity automation on Landlord create.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// agentSignatureHtml — branded email signature + CTA link grid, appended to every email.
function agentCtaHtml(u = {}) {
  const fullName = u.full_name || '';
  const firstName = fullName.split(' ').filter(Boolean)[0] || fullName || '';
  const linkedinUrl = u.linkedin_url || '';
  const pfUrl = u.pf_profile_url || '';
  const pfRating = u.pf_rating;
  const pfDeals = u.pf_deals_count;
  const pfValue = u.pf_deals_value_label || '';
  const statLabel = u.signature_stat_label || '';
  const pfSubtitle = `SuperAgent${pfRating ? ` · ${pfRating}⭐` : ''}${pfDeals ? ` · ${pfDeals} deals` : ''}${pfValue ? ` · ${pfValue}` : ''}`;
  const stat = statLabel ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:13px;font-weight:700;margin:14px 0 10px;">🏆 ${statLabel}</div>` : '';
  const card = (bg, title, sub, href, darkText, right) => {
    const tc = darkText ? '#1a1205' : '#ffffff';
    const sc = darkText ? '#5a4a1a' : '#dbe6f5';
    const pad = right ? 'padding:0 0 10px 5px;' : 'padding:0 5px 10px 0;';
    return `<td width="50%" valign="top" style="${pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;"><a href="${href}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:${tc};font-size:14px;font-weight:700;">${title}</div><div style="font-family:Arial,Helvetica,sans-serif;color:${sc};font-size:11px;margin-top:3px;">${sub}</div></a></td></tr></table></td>`;
  };
  const linkedinCard = `<td colspan="2" valign="top" style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2D77E8" style="padding:14px 16px;border-radius:12px;"><a href="${linkedinUrl || 'https://www.linkedin.com'}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:14px;font-weight:700;">💼 LinkedIn →</div><div style="font-family:Arial,Helvetica,sans-serif;color:#d4e6ff;font-size:11px;margin-top:3px;">${firstName ? firstName + "'s profile" : 'LinkedIn profile'}</div></a></td></tr></table></td>`;
  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>${card('#233552', `⭐ ${firstName} on Property Finder →`, pfSubtitle, pfUrl || 'https://www.propertyfinder.ae', false, false)}${card('#C5A059', '🏛 Erudite Listings →', 'All live listings for sale', 'https://www.eruditeproperty.com', true, true)}</tr><tr>${card('#10A492', '👥 Meet the Team →', 'eruditeproperty.com', 'https://www.eruditeproperty.com', false, false)}${card('#D7338C', '📷 Instagram →', '@eruditeproperty7', 'https://instagram.com/eruditeproperty7', false, true)}</tr><tr>${linkedinCard}</tr></table>`;
  return [stat, cta].filter(Boolean).join('');
}
function agentSignatureHtml(u = {}) {
  const fullName = u.full_name || '';
  const cta = agentCtaHtml(u);
  return `<div style="margin-top:18px;border-top:1px solid #eee;padding-top:14px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 2px;color:#1e293b;font-size:14px;">Best regards,</p><p style="margin:0 0 2px;color:#1e293b;font-size:15px;font-weight:700;">${fullName || 'Erudite Real Estate'}</p><p style="margin:0 0 10px;color:#C5A059;font-size:13px;font-weight:600;">Erudite Real Estate</p>${cta}</div>`;
}

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
    let agentUser = {};
    if (agentEmail) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: agentEmail });
        if (users && users.length > 0) {
          agentName = users[0].full_name || agentName;
          agentUser = users[0];
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
          emailBody.replace(/\n/g, '<br/>') + agentSignatureHtml(agentUser),
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