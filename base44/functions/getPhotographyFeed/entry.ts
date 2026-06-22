// getPhotographyFeed — now driven by PhotographyTask assignments.
// Returns ONLY tasks assigned to the logged-in photographer, with pre-shoot info
// + media flags. Sensitive landlord fields (phone/commission/price/contract) NEVER included.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Tasks assigned to THIS logged-in user (the photographer).
    const tasks = await base44.entities.PhotographyTask.filter({
      assigned_photographer_email: user.email,
    });

    // Preload landlords + properties to join (small data set).
    const landlords = await base44.entities.Landlord.list();
    const properties = await base44.entities.LandlordProperty.list();

    const feed = tasks.map((task) => {
      const ll = landlords.find((l) => l.id === task.landlord_id) || {};
      const lp = properties.find((p) => p.id === task.landlord_property_id) || {};

      return {
        task_id: task.id,
        task_stage: task.task_stage,

        // Unit identity (safe):
        owner_name: ll.full_name_en || ll.full_name || null,
        project: ll.project_name || null,
        unit_reference: ll.unit_reference || null,

        // Pre-shoot info from the task (agent-entered):
        unit_condition: task.unit_condition || null,
        furnishing: task.furnishing || null,
        has_bedsheets: task.has_bedsheets ?? null,
        has_pillows: task.has_pillows ?? null,
        electricity_on: task.electricity_on ?? null,
        water_on: task.water_on ?? null,
        staging_needed: task.staging_needed || null,
        what_to_bring: task.what_to_bring || null,

        // Editing/completion fields:
        editing_substatus: task.editing_substatus || null,
        completion_notes: task.completion_notes || null,
        video_link: task.video_link || null,
        photos_link: task.photos_link || null,

        // Access info (from LandlordProperty — safe operational fields):
        keys_location: lp.keys_location || null,
        key_access_instructions: lp.key_access_instructions || null,

        // Media flags (from LandlordProperty):
        photography_status: lp.photography_status || 'none',
        has_360_tour: lp.has_360_tour ?? false,
        has_drone_footage: lp.has_drone_footage ?? false,
        has_video_walkthrough: lp.has_video_walkthrough ?? false,
        has_floor_plan: lp.has_floor_plan ?? false,
        landlord_property_id: lp.id,

        // Assignment info:
        assigned_photographer_email: task.assigned_photographer_email || null,

        // DELIBERATELY OMITTED: phone, whatsapp, email, commission, price, contract
      };
    });

    return Response.json({ feed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});