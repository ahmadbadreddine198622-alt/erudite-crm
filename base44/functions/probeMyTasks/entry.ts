// probeMyTasks — THROWAWAY. Shows tasks for whoever is logged in.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    const all = await base44.entities.PhotographyTask.list();
    const mine = all.filter(t => t.assigned_photographer_email === me.email);
    return Response.json({
      my_login_email: me.email,
      total_tasks: all.length,
      tasks_assigned_to_me: mine.length,
      all_assignments: all.map(t => t.assigned_photographer_email),
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});