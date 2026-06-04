// probeFeedAsDari — THROWAWAY. Confirms the feed join returns Tuiara's pre-shoot data.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const tasks = await base44.entities.PhotographyTask.filter({
      assigned_photographer_email: 'dari@erudite-estate.com',
    });
    const properties = await base44.entities.LandlordProperty.list();
    const rows = tasks.map(t => {
      const lp = properties.find(p => p.id === t.landlord_property_id) || {};
      return {
        task_stage: t.task_stage,
        unit_condition: t.unit_condition,
        furnishing: t.furnishing,
        has_bedsheets: t.has_bedsheets,
        has_pillows: t.has_pillows,
        electricity_on: t.electricity_on,
        water_on: t.water_on,
        staging_needed: t.staging_needed,
        what_to_bring: t.what_to_bring,
        keys_location: lp.keys_location,
      };
    });
    return Response.json({ count: tasks.length, rows });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
});