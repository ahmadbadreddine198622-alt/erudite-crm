import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let allPhones = [];
    let skip = 0;
    
    while (true) {
      const batch = await base44.entities.WhatsAppConversation.list(undefined, 100, skip);
      if (!batch || batch.length === 0) break;
      
      for (const conv of batch) {
        const phone = conv.data?.wa_phone_e164 || conv.data?.phone_number || 'N/A';
        allPhones.push(phone);
      }
      
      if (batch.length < 100) break;
      skip += 100;
    }

    return Response.json({
      total: allPhones.length,
      phones: allPhones
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});