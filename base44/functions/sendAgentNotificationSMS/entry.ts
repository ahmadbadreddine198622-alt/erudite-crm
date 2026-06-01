import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import twilio from 'npm:twilio';

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

    // Get Twilio credentials from secrets
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    const client = twilio(accountSid, authToken);

    // Get agent phone from User entity
    const users = await base44.entities.User.filter({ email: agent_email });
    const agent = users[0];
    
    if (!agent?.phone) {
      return Response.json({ error: 'Agent phone number not found' }, { status: 404 });
    }

    const message = `🎯 New Lead Assigned\n\nLead: ${lead_full_name}\nSource: ${lead_source}\nScore: ${ai_lead_score || 'N/A'}\n\nView: ${Deno.env.get('BASE44_APP_URL') || 'https://dubai-estate-pro.base44.app'}/leads?id=${lead_id}`;

    const sms = await client.messages.create({
      body: message,
      from: fromNumber,
      to: agent.phone,
    });

    return Response.json({ 
      success: true, 
      message_sid: sms.sid,
      status: 'sent'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      details: 'Failed to send SMS notification'
    }, { status: 500 });
  }
});