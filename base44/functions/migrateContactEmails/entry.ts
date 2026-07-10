import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all contacts
    const contacts = await base44.entities.Contact.list();
    
    let migrated = 0;
    let alreadyMigrated = 0;
    let noEmail = 0;
    const updates = [];

    for (const contact of contacts) {
      // Skip if already has emails array
      if (contact.emails && Array.isArray(contact.emails) && contact.emails.length > 0) {
        alreadyMigrated++;
        continue;
      }

      // Prepare update
      if (contact.email) {
        updates.push({
          id: contact.id,
          emails: [contact.email],
        });
        migrated++;
      } else {
        updates.push({
          id: contact.id,
          emails: [],
        });
        noEmail++;
      }
    }

    // Bulk update in batches of 500
    const batchSize = 500;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await base44.entities.Contact.bulkUpdate(batch);
    }

    return Response.json({
      success: true,
      total: contacts.length,
      migrated,
      alreadyMigrated,
      noEmail,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});