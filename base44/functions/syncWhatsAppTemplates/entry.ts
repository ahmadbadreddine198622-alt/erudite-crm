import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Sync WhatsApp templates from Meta Graph API
 * Fetches approved message templates from your WhatsApp Business account
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      return Response.json({ error: 'WhatsApp credentials not configured' }, { status: 500 });
    }

    // Fetch templates from Meta Graph API
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${phoneNumberId}/message_templates?access_token=${accessToken}&limit=100`
    );

    if (!response.ok) {
      const error = await response.json();
      return Response.json({ 
        error: error.error?.message || 'Failed to fetch templates',
        details: error 
      }, { status: response.status });
    }

    const data = await response.json();
    const metaTemplates = data.data || [];

    // Sync to ReplyTemplate entity
    let created = 0;
    let updated = 0;

    for (const template of metaTemplates) {
      const existing = await base44.entities.ReplyTemplate.filter({ 
        name: template.name 
      }).then(t => t[0]);

      const templateData = {
        name: template.name,
        category: 'meta_template',
        body: template.components?.find(c => c.type === 'BODY')?.text || '',
        is_favorite: false,
        placeholders: extractPlaceholders(template.components?.find(c => c.type === 'BODY')?.text || ''),
        meta_template_id: template.id,
        meta_status: template.status,
        meta_category: template.category,
        meta_language: template.language,
        is_meta_template: true
      };

      if (existing) {
        await base44.entities.ReplyTemplate.update(existing.id, templateData);
        updated++;
      } else {
        await base44.entities.ReplyTemplate.create(templateData);
        created++;
      }
    }

    return Response.json({
      success: true,
      synced: metaTemplates.length,
      created,
      updated,
      templates: metaTemplates
    });
  } catch (error) {
    console.error('syncWhatsAppTemplates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractPlaceholders(text) {
  const matches = text.match(/{{\w+}}/g) || [];
  return [...new Set(matches)];
}