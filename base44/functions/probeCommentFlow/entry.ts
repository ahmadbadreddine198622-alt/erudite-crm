// probeCommentFlow — THROWAWAY. Posts a test comment, reads it back.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();

    const tasks = await base44.entities.PhotographyTask.filter({
      assigned_photographer_email: me.email,
    });
    if (!tasks.length) return Response.json({ error: 'no tasks assigned to me' });
    const task = tasks[0];

    const created = await base44.entities.PhotographyComment.create({
      photography_task_id: task.id,
      landlord_property_id: task.landlord_property_id,
      author_email: me.email,
      author_role: 'agent',
      message: 'Test comment from probe',
      created_at: new Date().toISOString(),
    });

    const all = await base44.entities.PhotographyComment.filter({
      photography_task_id: task.id,
    });

    return Response.json({
      my_email: me.email,
      task_id: task.id,
      created_id: created?.id,
      comments_found: all.length,
      comments: all.map(c => ({ author: c.author_email, role: c.author_role, msg: c.message, at: c.created_at })),
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});