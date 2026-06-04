import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * ONE-TIME backfill: Reset all PhotographyTask records to task_stage = "inquiry".
 * This ensures the Inquiry column is populated for tasks that were created at pre_shoot_check.
 * 
 * Admin-only function.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const allTasks = await base44.entities.PhotographyTask.filter({});
    
    let updatedCount = 0;
    for (const task of allTasks) {
      await base44.entities.PhotographyTask.update(task.id, {
        task_stage: 'inquiry',
      });
      updatedCount++;
    }

    return Response.json({ 
      ok: true, 
      updated_count: updatedCount,
      message: `All ${updatedCount} PhotographyTask records reset to inquiry stage` 
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});