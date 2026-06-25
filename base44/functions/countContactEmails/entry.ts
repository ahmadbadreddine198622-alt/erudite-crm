import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const contacts = await base44.entities.Contact.list();
    
    const multiEmail = contacts.filter(c => 
      c.emails && Array.isArray(c.emails) && c.emails.length > 1
    );
    
    const singleEmail = contacts.filter(c => 
      c.emails && Array.isArray(c.emails) && c.emails.length === 1
    );
    
    const noEmail = contacts.filter(c => 
      !c.emails || !Array.isArray(c.emails) || c.emails.length === 0
    );

    return Response.json({
      total: contacts.length,
      multiEmail: multiEmail.length,
      singleEmail: singleEmail.length,
      noEmail: noEmail.length,
      multiEmailExamples: multiEmail.slice(0, 10).map(c => ({
        name: c.full_name,
        phone: c.phone,
        emails: c.emails,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});