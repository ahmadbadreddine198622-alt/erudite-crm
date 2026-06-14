import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ALL_PHONES = [];
    let skip = 0;
    const LIMIT = 500;
    
    while (true) {
      const batch = await base44.entities.WhatsAppConversation.list(undefined, LIMIT, skip);
      if (!batch || batch.length === 0) break;
      
      for (const conv of batch) {
        const phone = conv.wa_phone_e164 || conv.phone_number;
        if (phone) ALL_PHONES.push(phone);
      }
      
      skip += LIMIT;
      if (batch.length < LIMIT) break;
    }

    const output = ALL_PHONES.join('\n');
    
    return new Response(output, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});