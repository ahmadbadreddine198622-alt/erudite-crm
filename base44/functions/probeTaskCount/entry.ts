import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const tasks = await base44.entities.PhotographyTask.list();
    return Response.json({
      count: tasks.length,
      rows: tasks.map(t => ({
        id: t.id,
        landlord_property_id: t.landlord_property_id,
        assigned_photographer_email: t.assigned_photographer_email,
        task_stage: t.task_stage,
        assigned_at: t.assigned_at,
      })),
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
});