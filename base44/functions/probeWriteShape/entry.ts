// probeWriteShape — THROWAWAY. Confirms .get/.update work, then reverts.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Tuiara's LandlordProperty — find it via the link we verified.
    const props = await base44.entities.LandlordProperty.filter({
      landlord_id: '6a1f06fe902d0ef50470880e',
    });
    const lp = props[0];
    if (!lp) return Response.json({ error: 'no LandlordProperty for that landlord' });

    const before = lp.has_360_tour ?? false;

    // Try the update signature from the real function:
    const updated = await base44.entities.LandlordProperty.update(lp.id, {
      has_360_tour: !before,
    });

    // Revert immediately so we change nothing for real.
    await base44.entities.LandlordProperty.update(lp.id, { has_360_tour: before });

    return Response.json({
      ok: true,
      lp_id: lp.id,
      flipped_from: before,
      update_returned_keys: updated ? Object.keys(updated) : null,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
});