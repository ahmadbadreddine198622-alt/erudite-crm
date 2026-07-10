import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * pfGetKnownLocations — Workaround for the broken /v1/locations search endpoint.
 *
 * The PF /v1/locations?search= endpoint returns 404 from the downstream service
 * (confirmed by exhaustive probing — see pfProbeLocations). However, the /v1/listings
 * API response includes location.id on every listing. This function aggregates
 * all unique location IDs from our synced PFListing records and returns them as a
 * dropdown-friendly list so the publish flow can proceed without the locations API.
 *
 * After a syncPFListings run, this returns the full set of known location IDs
 * with their community/building names for the PFPublishPanel autocomplete.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Paginate through all PFListing records that have a pf_location_id
    const allLocations = [];
    const seen = new Set();
    let skip = 0;
    const pageSize = 500;

    while (true) {
      const batch = await base44.asServiceRole.entities.PFListing.filter(
        { pf_location_id: { $ne: null } },
        '-updated_date',
        pageSize,
        skip
      );
      if (!batch || batch.length === 0) break;

      for (const l of batch) {
        if (l.pf_location_id == null) continue;
        const key = String(l.pf_location_id);
        if (seen.has(key)) continue;
        seen.add(key);
        allLocations.push({
          id: l.pf_location_id,
          name: l.building_name || l.location || `Location ${l.pf_location_id}`,
          building_name: l.building_name || null,
          community: l.location || null,
          sample_listing_title: l.title || null,
          sample_listing_ref: l.reference_number || null,
        });
      }

      if (batch.length < pageSize) break;
      skip += pageSize;
    }

    // Sort by name for easy browsing
    allLocations.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return Response.json({
      locations: allLocations,
      total: allLocations.length,
      source: 'synced_pf_listings',
      note: 'Location IDs extracted from synced Property Finder listings. The /v1/locations search API is currently returning 404 on Property Finder\'s side — this is a workaround.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});