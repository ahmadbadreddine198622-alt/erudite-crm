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

    const processed = [];

    for (const messageId of messageIds) {
      // Dedup check
      const existing = await base44.asServiceRole.entities.Email.filter({ gmail_message_id: messageId });
      if (existing.length > 0) continue;

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: authHeader }
      );
      if (!res.ok) continue;
      const message = await res.json();

      const headers = message.payload?.headers ?? [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      const fromRaw = getHeader('From');
      const subject = getHeader('Subject') || '(No Subject)';
      const toRaw = getHeader('To');
      const dateRaw = getHeader('Date');

      const emailMatch = fromRaw.match(/<(.+?)>/);
      const fromEmail = emailMatch ? emailMatch[1].trim() : fromRaw.trim();
      const fromName = emailMatch ? fromRaw.replace(/<.+?>/, '').trim().replace(/^"|"$/g, '') : fromEmail;

      // Extract body
      const extractPart = (part, mimeType) => {
        if (part.mimeType === mimeType && part.body?.data) {
          return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (part.parts) {
          for (const p of part.parts) {
            const r = extractPart(p, mimeType);
            if (r) return r;
          }
        }
        return '';
      };

      const bodyText = extractPart(message.payload, 'text/plain');
      const bodyHtml = extractPart(message.payload, 'text/html');
      const snippet = message.snippet || bodyText.substring(0, 200);

      // Extract attachments
      const attachments = [];
      const extractAttachments = (part) => {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mime_type: part.mimeType,
            attachment_id: part.body.attachmentId,
          });
        }
        if (part.parts) part.parts.forEach(extractAttachments);
      };
      extractAttachments(message.payload);

      // Check if sender is a known lead
      const existingLeads = await base44.asServiceRole.entities.Lead.filter({ email: fromEmail });
      let leadId = existingLeads.length > 0 ? existingLeads[0].id : null;

      // Auto-tag using LLM
      let autoTags = [];
      try {
        const tagResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Classify this email into one or more tags from: ["sales", "support", "inquiry", "spam", "follow_up", "viewing_request", "offer", "document"].
Subject: ${subject}
Body: ${bodyText.substring(0, 500)}
Return only a JSON array of matching tags.`,
          response_json_schema: {
            type: 'object',
            properties: { tags: { type: 'array', items: { type: 'string' } } }
          }
        });
        autoTags = tagResult?.tags ?? [];
      } catch (_) {}

      const receivedAt = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();

      // Save email entity
      const email = await base44.asServiceRole.entities.Email.create({
        gmail_message_id: messageId,
        gmail_thread_id: message.threadId,
        lead_id: leadId,
        from_email: fromEmail,
        from_name: fromName,
        to: toRaw,
        subject,
        body_text: bodyText.substring(0, 5000),
        body_html: bodyHtml.substring(0, 10000),
        snippet,
        is_read: false,
        is_important: false,
        received_at: receivedAt,
        auto_tags: autoTags,
        attachments,
        labels: message.labelIds ?? [],
      });

      // Create or update lead
      if (!leadId) {
        const newLead = await base44.asServiceRole.entities.Lead.create({
          name: fromName || fromEmail,
          email: fromEmail,
          source: 'other',
          stage: 'new_lead',
          last_contact_date: receivedAt,
        });
        leadId = newLead.id;
        await base44.asServiceRole.entities.Email.update(email.id, { lead_id: leadId });
      } else {
        await base44.asServiceRole.entities.Lead.update(leadId, {
          last_contact_date: receivedAt,
        });
      }

      // Log as Activity
      await base44.asServiceRole.entities.Activity.create({
        lead_id: leadId,
        type: 'email',
        title: subject,
        description: snippet,
        metadata: {
          gmail_message_id: messageId,
          gmail_thread_id: message.threadId,
          from: fromRaw,
          email_id: email.id,
        },
      });

      processed.push(messageId);
    }

    return Response.json({ status: 'ok', processed: processed.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});