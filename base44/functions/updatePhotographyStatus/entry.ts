// updatePhotographyStatus — write counterpart to getPhotographyFeed.
// Lets the Photography page update ONLY photography fields on a LandlordProperty.
// Hard allow-list: cannot write stage, contact, or financial fields.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ALLOWED_MEDIA_FLAGS = [
  'has_360_tour',
  'has_drone_footage',
  'has_video_walkthrough',
  'has_floor_plan',
];
const ALLOWED_STATUS = ['none', 'phone_quality', 'professional_done', 'scheduled'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { landlord_property_id, updates } = body ?? {};

    if (!landlord_property_id) {
      return Response.json({ error: 'landlord_property_id required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return Response.json({ error: 'updates object required' }, { status: 400 });
    }

    // Build a SAFE patch: only allow-listed fields survive. Everything else dropped.
    const safePatch = {};
    for (const flag of ALLOWED_MEDIA_FLAGS) {
      if (flag in updates) safePatch[flag] = Boolean(updates[flag]);
    }
    if ('photography_status' in updates) {
      if (!ALLOWED_STATUS.includes(updates.photography_status)) {
        return Response.json(
          { error: `invalid photography_status. Allowed: ${ALLOWED_STATUS.join(', ')}` },
          { status: 400 },
        );
      }
      safePatch.photography_status = updates.photography_status;
    }
    if ('photoshoot_scheduled_at' in updates) {
      safePatch.photoshoot_scheduled_at = updates.photoshoot_scheduled_at;
    }

    if (Object.keys(safePatch).length === 0) {
      return Response.json({ error: 'no valid photography fields in updates' }, { status: 400 });
    }

    // 3. Read current record to derive status.
    const matches = await base44.entities.LandlordProperty.filter({ id: landlord_property_id });
    const current = matches[0];
    if (!current) {
      return Response.json({ error: 'LandlordProperty not found' }, { status: 404 });
    }

    // 4. Resulting flag state (current merged with patch) for status derivation.
    const resulting = { ...current, ...safePatch };
    const allFour =
      resulting.has_360_tour === true &&
      resulting.has_drone_footage === true &&
      resulting.has_video_walkthrough === true &&
      resulting.has_floor_plan === true;

    // 4. Derive status server-side. All four -> professional_done; un-tick reverses.
    //    Only manages professional_done <-> none; leaves phone_quality/scheduled alone.
    if (allFour) {
      safePatch.photography_status = 'professional_done';
    } else if (current.photography_status === 'professional_done' && !allFour) {
      safePatch.photography_status = 'none';
    }

    // NOTE: stage, phone, commission, price, contract fields are NOT in the
    // allow-list and can never be written by this function.
    const updated = await base44.entities.LandlordProperty.update(
      landlord_property_id,
      safePatch,
    );

    return Response.json({ ok: true, id: landlord_property_id, applied: safePatch, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});