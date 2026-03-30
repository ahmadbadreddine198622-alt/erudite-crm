import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id, new_tags } = await req.json();

    if (!lead_id || !new_tags || new_tags.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lead = await base44.asServiceRole.entities.Lead.read(lead_id);

    // Find or create tag-based folders
    for (const tag of new_tags) {
      const existingFolders = await base44.asServiceRole.entities.ContactFolder.filter({
        folder_type: 'tag_based',
        tag: tag
      });

      let folderId;
      if (existingFolders.length > 0) {
        folderId = existingFolders[0].id;
      } else {
        const newFolder = await base44.asServiceRole.entities.ContactFolder.create({
          folder_name: tag,
          folder_type: 'tag_based',
          tag: tag,
          is_auto_populated: true,
          contact_count: 0
        });
        folderId = newFolder.id;
      }

      // Increment folder count
      const folder = await base44.asServiceRole.entities.ContactFolder.read(folderId);
      const newCount = (folder.contact_count || 0) + 1;
      await base44.asServiceRole.entities.ContactFolder.update(folderId, {
        contact_count: newCount
      });
    }

    // Update lead with new tags
    const updatedLead = await base44.asServiceRole.entities.Lead.update(lead_id, {
      tags: [...new Set([...(lead.tags || []), ...new_tags])]
    });

    // Log history
    await base44.asServiceRole.entities.ContactHistory.create({
      lead_id,
      change_type: 'tagged',
      old_value: { tags: lead.tags },
      new_value: { tags: updatedLead.tags },
      changed_by: user.email
    });

    return Response.json({
      success: true,
      lead_id,
      tags: updatedLead.tags
    });

  } catch (error) {
    console.error('Folder update error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});