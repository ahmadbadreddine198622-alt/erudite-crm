import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agent_email, agent_name, lead_full_name, lead_source, ai_lead_score, lead_id } = await req.json();

    if (!agent_email || !lead_full_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use Base44 SendEmail integration
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
          <td style="padding: 8px; border: 1px solid #ddd;">${lead_source}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>AI Lead Score:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ai_lead_score || 'N/A'}</td>
        </tr>
      </table>
      <p>
        <a href="${Deno.env.get('BASE44_APP_URL') || 'https://dubai-estate-pro.base44.app'}/leads?id=${lead_id}" 
           style="background: #f59e0b; color: #0F1419; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Lead in CRM
        </a>
      </p>
      <p style="color: #666; font-size: 12px;">Erudite Property CRM</p>
    `;

    const result = await base44.integrations.Core.SendEmail({
      to: agent_email,
      subject,
      html: body,
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