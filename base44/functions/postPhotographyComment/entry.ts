import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Posts a comment to a PhotographyTask thread.
 * Payload: { photography_task_id, landlord_property_id, message }
 * 
 * - Requires authentication
 * - Sets author_role based on whether user matches task's assigned_photographer_email
 * - Rejects empty messages
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photography_task_id, landlord_property_id, message } = await req.json();
    
    if (!photography_task_id || !landlord_property_id) {
      return Response.json({ error: 'photography_task_id and landlord_property_id required' }, { status: 400 });
    }
    
    if (!message || message.trim() === '') {
      return Response.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // Fetch the task to determine author role
    const task = await base44.entities.PhotographyTask.get(photography_task_id);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Determine author role
    const authorRole = task.assigned_photographer_email === user.email ? 'photographer' : 'agent';

    // Create the comment
    const comment = await base44.entities.PhotographyComment.create({
      photography_task_id,
      landlord_property_id,
      author_email: user.email,
      author_role: authorRole,
      message: message.trim(),
      created_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, comment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});