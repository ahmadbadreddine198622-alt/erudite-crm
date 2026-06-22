// getPhotographyDashboardSummary — Returns photography pipeline stats and recent tasks
// Shows: photography status counts, recent assignments, completion rates

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all photography tasks
    const allTasks = await base44.entities.PhotographyTask.list('-created_date', 500);
    
    // Count by stage
    const stageCounts = {};
    allTasks.forEach(task => {
      const stage = task.task_stage || 'unknown';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    // Get recent tasks with landlord info
    const recentTasks = allTasks.slice(0, 10);
    const landlordIds = recentTasks.map(t => t.landlord_id).filter(Boolean);
    const landlords = await base44.entities.Landlord.filter({ id: { $in: landlordIds } });
    const landlordMap = {};
    landlords.forEach(ll => landlordMap[ll.id] = ll);

    const tasksWithLandlords = recentTasks.map(task => ({
      ...task,
      owner_name: landlordMap[task.landlord_id]?.full_name_en || landlordMap[task.landlord_id]?.full_name || 'Unknown',
      project_name: landlordMap[task.landlord_id]?.project_name,
      unit_reference: landlordMap[task.landlord_id]?.unit_reference,
    }));

    // Calculate completion rate
    const completed = stageCounts.complete || 0;
    const total = allTasks.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Media flags summary
    const mediaCounts = {
      has_360_tour: allTasks.filter(t => t.has_360_tour === true).length,
      has_drone_footage: allTasks.filter(t => t.has_drone_footage === true).length,
      has_video_walkthrough: allTasks.filter(t => t.has_video_walkthrough === true).length,
      has_floor_plan: allTasks.filter(t => t.has_floor_plan === true).length,
    };

    return Response.json({
      stageCounts,
      totalTasks: total,
      completedTasks: completed,
      completionRate,
      recentTasks: tasksWithLandlords,
      mediaCounts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});