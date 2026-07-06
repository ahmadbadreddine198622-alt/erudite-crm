import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      agent_email, 
      agent_name, 
      lead_full_name, 
      lead_source, 
      ai_lead_score, 
      lead_id,
      contact_id,
      contact_full_name,
      contact_email,
      contact_phone,
      notification_type,
      conversation_id,
      conversation_phone,
      assigned_by
    } = await req.json();

    if (!agent_email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch the agent's profile to build their branded signature + CTA links.
    let agentUser = {};
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: agent_email });
      if (users && users.length > 0) agentUser = users[0];
    } catch (_) { /* best-effort */ }

    // Handle different notification types
    if (notification_type === 'conversation_assigned') {
      const subject = `💬 WhatsApp Conversation Assigned: ${lead_full_name || conversation_phone}`;
      const body = `
        <h2>WhatsApp Conversation Assigned</h2>
        <p>Hi ${agent_name || agent_email.split('@')[0]},</p>
        <p>A WhatsApp conversation has been assigned to you:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Contact:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${lead_full_name || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${conversation_phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Assigned by:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${assigned_by || 'Manager'}</td>
          </tr>
        </table>
        <p>
          <a href="https://dubai-estate-pro.base44.app/whatsapp" 
             style="background: #25D366; color: #0F1419; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Open WhatsApp Inbox
          </a>
        </p>
        ${agentSignatureHtml(agentUser)}
      `;

      const result = await base44.integrations.Core.SendEmail({
        to: agent_email,
        subject,
        body,
      });

      return Response.json({ 
        success: true, 
        email_id: result?.message_id || 'sent',
        status: 'sent'
      });
    }

    if (notification_type === 'contact_assigned') {
      const subject = `👤 Contact Assigned: ${contact_full_name || contact_email}`;
      const body = `
        <h2>Contact Assigned</h2>
        <p>Hi ${agent_name || agent_email.split('@')[0]},</p>
        <p>A contact has been assigned to you:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Name:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${contact_full_name || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${contact_email || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${contact_phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Assigned by:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${assigned_by || 'Manager'}</td>
          </tr>
        </table>
        <p>
          <a href="https://dubai-estate-pro.base44.app/contacts" 
             style="background: #3b82f6; color: #0F1419; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Contact in CRM
          </a>
        </p>
        ${agentSignatureHtml(agentUser)}
      `;

      const result = await base44.integrations.Core.SendEmail({
        to: agent_email,
        subject,
        body,
      });

      return Response.json({ 
        success: true, 
        email_id: result?.message_id || 'sent',
        status: 'sent'
      });
    }

    if (notification_type === 'lead_assigned') {
      const subject = `🎯 Lead Assigned: ${lead_full_name}`;
      const body = `
        <h2>Lead Assigned</h2>
        <p>Hi ${agent_name || agent_email.split('@')[0]},</p>
        <p>A new lead has been assigned to you:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Lead Name:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${lead_full_name || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Source:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${lead_source || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>AI Lead Score:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ai_lead_score || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Assigned by:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${assigned_by || 'Manager'}</td>
          </tr>
        </table>
        <p>
          <a href="https://dubai-estate-pro.base44.app/leads?id=${lead_id}" 
             style="background: #f59e0b; color: #0F1419; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Lead in CRM
          </a>
        </p>
        ${agentSignatureHtml(agentUser)}
      `;

      const result = await base44.integrations.Core.SendEmail({
        to: agent_email,
        subject,
        body,
      });

      return Response.json({ 
        success: true, 
        email_id: result?.message_id || 'sent',
        status: 'sent'
      });
    }

    // Default: lead assignment
    const subject = `🎯 New Lead Assigned: ${lead_full_name}`;
    const body = `
      <h2>New Lead Assignment</h2>
      <p>Hi ${agent_name || 'Agent'},</p>
      <p>You've been assigned a new lead:</p>
      <table style="border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Lead Name:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${lead_full_name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Source:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${lead_source || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>AI Lead Score:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ai_lead_score || 'N/A'}</td>
        </tr>
      </table>
      <p>
        <a href="https://dubai-estate-pro.base44.app/leads?id=${lead_id}" 
           style="background: #f59e0b; color: #0F1419; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Lead in CRM
        </a>
      </p>
      ${agentSignatureHtml(agentUser)}
    `;

    // Use Gmail integration (already authorized)
    const result = await base44.integrations.Core.SendEmail({
      to: agent_email,
      subject,
      body,
    });

    return Response.json({ 
      success: true, 
      email_id: result?.message_id || 'sent',
      status: 'sent'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      details: 'Failed to send email notification'
    }, { status: 500 });
  }
});