import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get landlords in photography stages
    const landlords = await base44.entities.Landlord.filter({
      stage: { $in: ['photos_videos', 'photographer_scheduling'] },
    });

    // Get all landlord properties
    const properties = await base44.entities.LandlordProperty.list();

    // Merge data - one row per landlord with property photography fields
    const feed = landlords.map((landlord) => {
      const property = properties.find((p) => p.landlord_id === landlord.id);
      
      return {
        landlord_id: landlord.id,
        landlord_property_id: property?.id || null,
        owner_name: landlord.full_name_en || landlord.full_name,
        project: landlord.project_name,
        unit_reference: landlord.unit_reference,
        stage: landlord.stage,
        // Photography status from property
        photography_status: property?.photography_status || 'none',
        // Media flags
        has_360_tour: property?.has_360_tour || false,
        has_drone_footage: property?.has_drone_footage || false,
        has_video_walkthrough: property?.has_video_walkthrough || false,
        has_floor_plan: property?.has_floor_plan || false,
        // Access info
        keys_location: property?.keys_location,
        key_access_instructions: property?.key_access_instructions,
        photoshoot_scheduled_at: property?.photoshoot_scheduled_at,
      };
    });

    return Response.json({ feed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});