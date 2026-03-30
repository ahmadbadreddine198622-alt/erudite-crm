import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { master_lead_id, duplicate_lead_ids, merge_reason = 'manual_merge' } = await req.json();

    if (!master_lead_id || !duplicate_lead_ids || duplicate_lead_ids.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const masterLead = await base44.asServiceRole.entities.Lead.read(master_lead_id);

    // Merge data: combine tags, keep oldest date
    let mergedTags = [...(masterLead.tags || [])];
    let mergedAutoTags = [...(masterLead.auto_tags || [])];
    let earliestContact = masterLead.last_contact_date;

    for (const dupId of duplicate_lead_ids) {
      const dupLead = await base44.asServiceRole.entities.Lead.read(dupId);
      
      // Merge tags
      mergedTags = [...new Set([...mergedTags, ...(dupLead.tags || [])])];
      mergedAutoTags = [...new Set([...mergedAutoTags, ...(dupLead.auto_tags || [])])];

      // Keep earliest contact
      if (dupLead.last_contact_date && (!earliestContact || dupLead.last_contact_date < earliestContact)) {
        earliestContact = dupLead.last_contact_date;
      }

      // Mark as duplicate
      await base44.asServiceRole.entities.Lead.update(dupId, {
        is_duplicate_of: master_lead_id,
        stage: 'closed_lost' // Mark as archived
      });

      // Log history
      await base44.asServiceRole.entities.ContactHistory.create({
        lead_id: dupId,
        change_type: 'merged',
        new_value: { merged_into: master_lead_id },
        changed_by: user.email
      });
    }

    // Update master lead
    const updatedMaster = await base44.asServiceRole.entities.Lead.update(master_lead_id, {
      tags: mergedTags,
      auto_tags: mergedAutoTags,
      last_contact_date: earliestContact
    });

    // Create duplicate mapping
    await base44.asServiceRole.entities.DuplicateMapping.create({
      master_lead_id,
      duplicate_lead_ids,
      merge_reason
    });

    // Log merge history
    await base44.asServiceRole.entities.ContactHistory.create({
      lead_id: master_lead_id,
      change_type: 'merged',
      new_value: { merged_ids: duplicate_lead_ids, total_merged: duplicate_lead_ids.length },
      changed_by: user.email
    });

    return Response.json({
      success: true,
      master_lead_id,
      merged_count: duplicate_lead_ids.length,
      merged_lead: updatedMaster
    });

  } catch (error) {
    console.error('Merge error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});