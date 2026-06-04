import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * THROWAWAY diagnostic function — shows stage timestamps for current user's PhotographyTask records.
 * Read-only, no writes.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    
    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const all = await base44.entities.PhotographyTask.filter({
      assigned_photographer_email: me.email,
    });

    return Response.json(all.map(t => ({
      task_id: t.id,
      stage: t.task_stage,
      started_at: t.started_at,
      shot_at: t.shot_at,
      uploaded_3d_at: t.uploaded_3d_at,
      editing_at: t.editing_at,
      completed_at: t.completed_at,
      handed_to_listing_at: t.handed_to_listing_at,
    })));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});