import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Advances a PhotographyTask to the next stage in the workflow.
 * Payload: { task_id, new_stage }
 * 
 * Valid stages: inquiry, pre_shoot_check, shooting, uploaded_3d, editing, complete, handed_to_listing
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { task_id, new_stage } = await req.json();
    if (!task_id || !new_stage) {
      return Response.json({ error: 'task_id and new_stage required' }, { status: 400 });
    }

    const validStages = ['inquiry', 'pre_shoot_check', 'shooting', 'uploaded_3d', 'editing', 'complete', 'handed_to_listing'];
    if (!validStages.includes(new_stage)) {
      return Response.json({ error: 'Invalid stage' }, { status: 400 });
    }

    // Verify task is assigned to this photographer
    const task = await base44.entities.PhotographyTask.get(task_id);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.assigned_photographer_email !== user.email) {
      return Response.json({ error: 'Not authorized for this task' }, { status: 403 });
    }

    await base44.entities.PhotographyTask.update(task_id, { task_stage: new_stage });

    return Response.json({ ok: true, task_id, new_stage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});