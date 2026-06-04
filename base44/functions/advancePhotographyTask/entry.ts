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

    // Set timestamp for the stage being entered (only if not already set)
    const timestampUpdates: any = {};
    const stageTimestampMap: Record<string, string> = {
      'pre_shoot_check': 'started_at',
      'shooting': 'shot_at',
      'uploaded_3d': 'uploaded_3d_at',
      'editing': 'editing_at',
      'complete': 'completed_at',
      'handed_to_listing': 'handed_to_listing_at',
    };
    
    const timestampField = stageTimestampMap[new_stage];
    if (timestampField && !task[timestampField]) {
      timestampUpdates[timestampField] = new Date().toISOString();
    }

    await base44.entities.PhotographyTask.update(task_id, { 
      task_stage: new_stage,
      ...timestampUpdates 
    });

    return Response.json({ ok: true, task_id, new_stage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});