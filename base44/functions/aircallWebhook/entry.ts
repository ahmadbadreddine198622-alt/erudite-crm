import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Aircall Webhook Handler - Receives call events from Aircall
 * Creates leads automatically from calls and logs call activities
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify Aircall webhook signature (optional but recommended)
    const signature = req.headers.get('X-Aircall-Signature');
    // Add signature verification if needed
    
    const payload = await req.json();
    console.log('Aircall webhook received:', payload);

    // Extract call data from webhook
    const {
      id: aircall_id,
      direction,
      status,
      started_at,
      ended_at,
      duration,
      from: from_number,
      to: to_number,
      user: caller,
      contact: aircall_contact,
      tags = [],
      recording_url,
      voicemail_url
    } = payload;

    if (!aircall_id) {
      return Response.json({ error: 'Missing call ID' }, { status: 400 });
    }

    // Determine phone numbers
    const callerPhone = direction === 'inbound' ? from_number : to_number;
    const agentPhone = direction === 'inbound' ? to_number : from_number;
    
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(callerPhone);
    if (!normalizedPhone) {
      return Response.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    // Find existing lead by phone
    const leads = await base44.asServiceRole.entities.Lead.filter({ phone: normalizedPhone });
    let lead = leads[0];

    // Create lead if not exists
    if (!lead && aircall_contact) {
      const firstName = aircall_contact.first_name || '';
      const lastName = aircall_contact.last_name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unknown Caller';
      
      lead = await base44.asServiceRole.entities.Lead.create({
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        phone: normalizedPhone,
        email: aircall_contact.email || '',
        source: 'aircall_call',
        stage: 'intake_clarify',
        intent: 'unknown',
        status: 'active',
        assigned_agent_email: caller?.email || '',
        assigned_agent_name: caller?.name || '',
        notes: `Lead created from Aircall call (${direction})`,
      });

      console.log('Created new lead from Aircall call:', lead.id);
    }

    // Log call activity
    if (lead) {
      await base44.asServiceRole.entities.Activity.create({
        lead_id: lead.id,
        type: 'call',
        direction: direction,
        title: `Aircall ${direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`,
        description: `Duration: ${formatDuration(duration)}${status === 'missed' ? ' (Missed)' : ''}`,
        channel: 'aircall',
        status: status,
        completed_at: ended_at || new Date().toISOString(),
        agent_email: caller?.email || '',
        agent_name: caller?.name || '',
        source: 'aircall_webhook',
        metadata: {
          aircall_id,
          duration,
          recording_url,
          tags
        }
      });

      // Create AircallCall record for detailed tracking
      await base44.asServiceRole.entities.AircallCall.create({
        aircall_id,
        direction,
        status,
        duration: duration || 0,
        started_at,
        ended_at,
        from_number: from_number || '',
        to_number: to_number || '',
        agent_name: caller?.name || '',
        agent_email: caller?.email || '',
        recording_url: recording_url || '',
        voicemail_url: voicemail_url || '',
        lead_id: lead.id,
        lead_name: lead.full_name,
        tags,
        notes: status === 'missed' ? 'Missed call' : ''
      });

      console.log('Logged Aircall activity for lead:', lead.id);
    }

    return Response.json({ 
      success: true, 
      lead_id: lead?.id || null,
      aircall_id 
    });
  } catch (error) {
    console.error('Aircall webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function normalizePhoneNumber(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('971') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 10 && cleaned.substring(1).startsWith('5')) {
    return `+971${cleaned.substring(1)}`;
  }
  if (cleaned.length >= 10 && cleaned.length <= 15) return `+${cleaned}`;
  return null;
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}