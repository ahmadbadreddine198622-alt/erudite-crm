import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Updates editing/completion fields on a PhotographyTask.
 * Payload: { task_id, updates: { editing_substatus?, completion_notes?, video_link?, photos_link?, tour_3d_link? } }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { task_id, updates } = await req.json();
    if (!task_id || !updates) {
      return Response.json({ error: 'task_id and updates required' }, { status: 400 });
    }

    // Only allow specific fields
    const allowedFields = ['editing_substatus', 'completion_notes', 'video_link', 'photos_link', 'tour_3d_link'];
    const sanitizedUpdates: any = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Verify task is assigned to this photographer
    const task = await base44.entities.PhotographyTask.get(task_id);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.assigned_photographer_email !== user.email) {
      return Response.json({ error: 'Not authorized for this task' }, { status: 403 });
    }

    await base44.entities.PhotographyTask.update(task_id, sanitizedUpdates);

    // If media links were delivered, ping the landlord's assigned agent (non-fatal)
    const linkFields = ['tour_3d_link', 'video_link', 'photos_link'];
    const deliveredLinks = linkFields.filter((f) => sanitizedUpdates[f]);
    if (deliveredLinks.length > 0) {
      try {
        await base44.functions.invoke('notifyPhotographyEvent', { task_id, event: 'links_saved' });
      } catch (notifyErr) {
        console.error('notifyPhotographyEvent failed:', notifyErr.message);
      }
    }

    return Response.json({ ok: true, task_id, links_delivered: deliveredLinks });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});