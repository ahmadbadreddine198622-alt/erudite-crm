import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, landlord_property_id, title, description, angle } = await req.json();

    if (!landlord_property_id) return Response.json({ error: 'landlord_property_id is required' }, { status: 400 });
    if (!title) return Response.json({ error: 'title is required' }, { status: 400 });
    if (!description) return Response.json({ error: 'description is required' }, { status: 400 });

    const validAngles = ['luxury', 'investment', 'family'];
    if (angle && !validAngles.includes(angle)) {
      return Response.json({ error: `angle must be one of: ${validAngles.join(', ')}` }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.LandlordProperty.update(landlord_property_id, {
      listing_title: title,
      listing_description: description,
      listing_angle: angle || null,
    });

    return Response.json({ success: true, landlord_property_id, updated });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});