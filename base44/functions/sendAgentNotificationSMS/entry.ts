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

    // Get agent phone from User entity
    const users = await base44.entities.User.filter({ email: agent_email });
    const agent = users[0];
    
    if (!agent?.phone) {
      return Response.json({ error: 'Agent phone number not found' }, { status: 404 });
    }

    const message = `🎯 New Lead Assigned\n\nLead: ${lead_full_name}\nSource: ${lead_source}\nScore: ${ai_lead_score || 'N/A'}\n\nView: ${window.location.origin}/leads?id=${lead_id}`;

    // Use existing twilioSendSMS function
    const result = await base44.functions.invoke('twilioSendSMS', {
      phone: agent.phone,
      message: message,
    });

    return Response.json({ 
      success: true, 
      result,
      status: 'sent'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      details: 'Failed to send SMS notification'
    }, { status: 500 });
  }
});