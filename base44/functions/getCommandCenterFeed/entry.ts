// getCommandCenterFeed — Read-only aggregated view for the principal broker.
// Returns listing production data, photography data, and summary counts.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [landlords, properties] = await Promise.all([
      base44.asServiceRole.entities.Landlord.list(),
      base44.asServiceRole.entities.LandlordProperty.list(),
    ]);

    const propByLandlord = {};
    for (const p of properties) {
      if (p.landlord_id) propByLandlord[p.landlord_id] = p;
    }

    // ── LISTING PRODUCTION ──
    // All landlords with listing_manager_email set
    const listingUnits = landlords
      .filter(l => l.listing_manager_email && l.listing_manager_email.trim() !== '')
      .map(l => {
        const lp = propByLandlord[l.id] || {};
        return {
          landlord_id: l.id,
          owner_name: l.full_name_en || l.full_name || null,
          project: l.project_name || null,
          unit_reference: l.unit_reference || null,
          listing_manager_email: l.listing_manager_email,
          assigned_agent_email: l.assigned_agent_email || null,
          listing_production_stage: lp.listing_production_stage || 'received',
          landlord_stage: l.stage || null,
        };
      });

    // ── PHOTOGRAPHY ──
    // All landlords in photos_videos or photographer_scheduling stage
    const photoUnits = landlords
      .filter(l => l.stage === 'photos_videos' || l.stage === 'photographer_scheduling')
      .map(l => {
        const lp = propByLandlord[l.id] || {};
        return {
          landlord_id: l.id,
          owner_name: l.full_name_en || l.full_name || null,
          project: l.project_name || null,
          unit_reference: l.unit_reference || null,
          assigned_agent_email: l.assigned_agent_email || null,
          landlord_stage: l.stage || null,
          photography_status: lp.photography_status || 'none',
          has_360_tour: lp.has_360_tour ?? false,
          has_drone_footage: lp.has_drone_footage ?? false,
          has_video_walkthrough: lp.has_video_walkthrough ?? false,
          has_floor_plan: lp.has_floor_plan ?? false,
        };
      });

    // ── SUMMARY COUNTS ──
    // listing_production_stage counts
    const listingStages = ['received','permit_creation','listing_drafting','photos_upload','publishing','verification','live'];
    const listingStageCounts = {};
    for (const s of listingStages) listingStageCounts[s] = 0;
    for (const u of listingUnits) {
      const s = u.listing_production_stage || 'received';
      if (listingStageCounts[s] !== undefined) listingStageCounts[s]++;
    }

    // photography_status counts
    const photoStatuses = ['none','phone_quality','professional_done','scheduled'];
    const photoStatusCounts = {};
    for (const s of photoStatuses) photoStatusCounts[s] = 0;
    for (const u of photoUnits) {
      const s = u.photography_status || 'none';
      if (photoStatusCounts[s] !== undefined) photoStatusCounts[s]++;
    }

    // listing_manager assignments
    const managerCounts = {};
    for (const u of listingUnits) {
      const m = u.listing_manager_email;
      managerCounts[m] = (managerCounts[m] || 0) + 1;
    }

    const totalUnassigned = landlords.filter(l => !l.listing_manager_email || l.listing_manager_email.trim() === '').length;

    return Response.json({
      listing_units: listingUnits,
      photo_units: photoUnits,
      summary: {
        total_listing: listingUnits.length,
        total_photography: photoUnits.length,
        total_unassigned: totalUnassigned,
        listing_stage_counts: listingStageCounts,
        photo_status_counts: photoStatusCounts,
        manager_counts: managerCounts,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});