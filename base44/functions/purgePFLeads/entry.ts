import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Purge all Lead records where source = "property_finder" in small batches.
 * Safe to run multiple times — stops when none remain.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    let totalDeleted = 0;
    let rounds = 0;
    const MAX_ROUNDS = 200;

    while (rounds < MAX_ROUNDS) {
      // Fetch a small batch
      const batch = await base44.asServiceRole.entities.Lead.filter(
        { source: 'property_finder' },
        'created_date',
        50
      );

      if (!batch || batch.length === 0) break;

      // Delete each in parallel
      await Promise.all(batch.map(lead =>
        base44.asServiceRole.entities.Lead.delete(lead.id).catch(err => {
          console.error('Delete failed for', lead.id, err.message);
        })
      ));

      totalDeleted += batch.length;
      rounds++;
      console.log(`[purgePFLeads] Round ${rounds}: deleted ${batch.length}, total so far: ${totalDeleted}`);

      // Small pause to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    // Verify
    const remaining = await base44.asServiceRole.entities.Lead.filter(
      { source: 'property_finder' },
      'created_date',
      1
    );

    return Response.json({
      ok: true,
      total_deleted: totalDeleted,
      rounds,
      remaining_pf_leads: remaining.length === 0 ? 0 : '1+ (run again)',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});