import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 1. Grab landlords currently in the photography stages.
    const landlords = await base44.entities.Landlord.filter({
      stage: { $in: ['photos_videos', 'photographer_scheduling'] },
    });

    // 2. For the first one, dump its full key list (so we see exact field names),
    //    then try to find linked LandlordProperty rows by every plausible link field.
    const sample = landlords[0] ?? null;
    let landlordPropertyMatches = {};

    if (sample) {
      const candidates = ['landlord_id', 'landlord', 'landlordId', 'owner_id'];
      for (const f of candidates) {
        try {
          const rows = await base44.entities.LandlordProperty.filter({ [f]: sample.id });
          landlordPropertyMatches[f] = {
            count: rows.length,
            sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
          };
        } catch (e) {
          landlordPropertyMatches[f] = { error: String(e) };
        }
      }
    }

    return Response.json({
      landlordsInStage: landlords.length,
      sampleLandlordId: sample?.id ?? null,
      sampleLandlordKeys: sample ? Object.keys(sample) : [],   // exact Landlord field names
      landlordPropertyMatches,                                  // which link field actually hits
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});