/**
 * syncLandlordUnitReference
 *
 * Given a landlord_id, looks up all LandlordProperty links for that landlord,
 * fetches each linked Property's unit_no, then writes a comma-joined string
 * back to Landlord.unit_reference.
 *
 * Also callable from entity automations (LandlordProperty create/update/delete)
 * which pass { landlord_id } in the payload.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const landlord_id = body.landlord_id
      ?? body.data?.landlord_id  // entity automation payload
      ?? null;

    if (!landlord_id) {
      return Response.json({ error: 'landlord_id is required' }, { status: 400 });
    }

    // Fetch all LandlordProperty links for this landlord
    const links = await base44.asServiceRole.entities.LandlordProperty.filter(
      { landlord_id },
      '-created_date',
      200
    );

    let unitRef = '';

    if (links.length > 0) {
      // Fetch all linked properties in parallel
      const properties = await Promise.all(
        links
          .filter(l => l.property_id)
          .map(l => base44.asServiceRole.entities.Property.filter({ id: l.property_id }, '-created_date', 1))
      );

      // Each filter call returns an array; flatten and collect unit_no values
      const unitNos = properties
        .flat()
        .map(p => p.unit_no)
        .filter(Boolean);

      unitRef = unitNos.join(', ');
    }

    // Update the Landlord record
    await base44.asServiceRole.entities.Landlord.update(landlord_id, {
      unit_reference: unitRef || null,
    });

    return Response.json({ success: true, landlord_id, unit_reference: unitRef || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});