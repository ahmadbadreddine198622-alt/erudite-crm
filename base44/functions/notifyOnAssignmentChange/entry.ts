import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    // Check if assigned_agent_email changed
    if (!data?.assigned_agent_email || data.assigned_agent_email === old_data?.assigned_agent_email) {
      return Response.json({ skipped: 'No assignment change' });
    }

    // Get the user who made the assignment (if available)
    let assigned_by = 'System';
    try {
      const currentUser = await base44.auth.me();
      if (currentUser) {
        assigned_by = currentUser.full_name || currentUser.email;
      }
    } catch (e) {
      // Service role context - no user
    }

    // Determine entity type and prepare notification data
    const isWhatsApp = event.entity_name === 'WhatsAppConversation';
    const isLead = event.entity_name === 'Lead';
    
    const notificationData = {
      agent_email: data.assigned_agent_email,
      assigned_by,
    };

    if (isWhatsApp) {
      // Fetch lead info if available
      let lead_full_name = null;
      if (data.lead_id) {
        try {
          const leads = await base44.asServiceRole.entities.Lead.filter({ id: data.lead_id }, '-created_date', 1);
          lead_full_name = leads?.[0]?.full_name;
        } catch (e) {
          console.warn('Could not fetch lead for WhatsApp conversation');
        }
      }

      notificationData.notification_type = 'conversation_assigned';
      notificationData.lead_full_name = lead_full_name || data.wa_display_name;
      notificationData.conversation_id = data.id;
      notificationData.conversation_phone = data.wa_phone_e164 || data.phone_number;

      await base44.functions.invoke('sendAgentNotificationEmail', notificationData);
      
      return Response.json({ 
        success: true, 
        message: `Email sent to ${data.assigned_agent_email} for WhatsApp conversation assignment` 
      });
    }

    if (isLead) {
      notificationData.notification_type = 'lead_assigned';
      notificationData.lead_full_name = data.full_name || data.name;
      notificationData.lead_id = data.id;
      notificationData.lead_source = data.source;
      notificationData.ai_lead_score = data.ai_lead_score;

      await base44.functions.invoke('sendAgentNotificationEmail', notificationData);
      
      return Response.json({ 
        success: true, 
        message: `Email sent to ${data.assigned_agent_email} for lead assignment` 
      });
    }

    return Response.json({ skipped: 'Unsupported entity type' });
  } catch (error) {
    console.error('Assignment notification error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});