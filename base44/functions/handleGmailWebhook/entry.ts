import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const messageIds = body.data?.new_message_ids ?? [];
    if (messageIds.length === 0) {
      return Response.json({ status: 'no_new_messages' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    for (const messageId of messageIds) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: authHeader }
      );
      if (!res.ok) continue;
      const message = await res.json();

      // Extract headers
      const headers = message.payload?.headers ?? [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      const fromRaw = getHeader('From');
      const subject = getHeader('Subject');
      const messageIdHeader = getHeader('Message-ID');

      // Parse sender name and email from "Name <email>" format
      const emailMatch = fromRaw.match(/<(.+?)>/);
      const senderEmail = emailMatch ? emailMatch[1] : fromRaw.trim();
      const senderName = emailMatch ? fromRaw.replace(/<.+?>/, '').trim().replace(/^"|"$/g, '') : senderEmail;

      if (!senderEmail) continue;

      // Extract plain text body
      let bodyText = '';
      const extractBody = (part) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (part.parts) {
          for (const p of part.parts) {
            const result = extractBody(p);
            if (result) return result;
          }
        }
        return '';
      };
      bodyText = extractBody(message.payload);

      // Check if a lead with this email already exists
      const existingLeads = await base44.asServiceRole.entities.Lead.filter({ email: senderEmail });

      let leadId;

      if (existingLeads.length > 0) {
        // Update existing lead's last contact date
        leadId = existingLeads[0].id;
        await base44.asServiceRole.entities.Lead.update(leadId, {
          last_contact_date: new Date().toISOString(),
        });
      } else {
        // Create a new lead
        const newLead = await base44.asServiceRole.entities.Lead.create({
          name: senderName || senderEmail,
          email: senderEmail,
          source: 'other',
          stage: 'new_lead',
          last_contact_date: new Date().toISOString(),
        });
        leadId = newLead.id;
      }

      // Log activity — deduplicate by Message-ID stored in metadata
      if (messageIdHeader) {
        const existingActivities = await base44.asServiceRole.entities.Activity.filter({
          lead_id: leadId,
          type: 'email',
        });
        const alreadyLogged = existingActivities.some(
          a => a.metadata?.gmail_message_id === messageId
        );
        if (alreadyLogged) continue;
      }

      await base44.asServiceRole.entities.Activity.create({
        lead_id: leadId,
        type: 'email',
        title: subject || '(No Subject)',
        description: bodyText.substring(0, 2000),
        metadata: {
          gmail_message_id: messageId,
          gmail_thread_id: message.threadId,
          from: fromRaw,
        },
      });
    }

    return Response.json({ status: 'ok', processed: messageIds.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});