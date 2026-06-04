import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Gets all comments for a PhotographyTask, sorted oldest-first.
 * Payload: { photography_task_id }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photography_task_id } = await req.json();
    
    if (!photography_task_id) {
      return Response.json({ error: 'photography_task_id required' }, { status: 400 });
    }

    const comments = await base44.entities.PhotographyComment.filter({
      photography_task_id,
    }, 'created_at');

    return Response.json({ ok: true, comments });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});