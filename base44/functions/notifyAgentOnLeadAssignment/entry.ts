import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Service role for automation trigger (no user auth needed)
    const { lead_id, old_assigned_agent_email, new_assigned_agent_email } = await req.json();

    if (!lead_id || !new_assigned_agent_email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Don't notify if agent didn't change
    if (old_assigned_agent_email === new_assigned_agent_email) {
      return Response.json({ skipped: true, reason: 'Agent unchanged' });
    }

    // Get lead data
    const lead = await base44.entities.Lead.get(lead_id);
    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const appUrl = window.location.origin;
    const notificationPayload = {
      agent_email: new_assigned_agent_email,
      agent_name: lead.assigned_agent_name || new_assigned_agent_email,
      lead_full_name: lead.full_name,
      lead_source: lead.source || 'Meta Ads',
      ai_lead_score: lead.ai_lead_score,
      lead_id: lead.id,
    };

    // 1. Send WhatsApp notification
    try {
      const users = await base44.entities.User.filter({ email: new_assigned_agent_email });
      const agent = users[0];
      
      if (agent?.phone) {
        const whatsappMessage = `🎯 New Lead Assigned\n\nLead: ${lead.full_name}\nSource: ${lead.source || 'Meta Ads'}\nScore: ${lead.ai_lead_score || 'N/A'}\n\nView: ${appUrl}/leads?id=${lead.id}`;
        
        await base44.functions.invoke('sendWhatsAppMessage', {
          phone: agent.phone,
          message: whatsappMessage,
        });
      }
    } catch (error) {
      console.error('WhatsApp notification failed:', error.message);
    }

    // 2. Send SMS notification
    try {
      await base44.functions.invoke('sendAgentNotificationSMS', notificationPayload);
    } catch (error) {
      console.error('SMS notification failed:', error.message);
    }

    // 3. Send Email notification
    try {
      await base44.functions.invoke('sendAgentNotificationEmail', notificationPayload);
    } catch (error) {
      console.error('Email notification failed:', error.message);
    }

    return Response.json({ 
      success: true, 
      lead_id,
      notified_agent: new_assigned_agent_email,
      channels: ['whatsapp', 'sms', 'email']
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      details: 'Failed to send agent notifications'
    }, { status: 500 });
  }
});