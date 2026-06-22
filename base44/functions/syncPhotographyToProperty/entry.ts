// syncPhotographyToProperty - Copies media links from PhotographyTask to LandlordProperty when task is completed
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { task_id } = await req.json();
    if (!task_id) {
      return Response.json({ error: 'task_id required' }, { status: 400 });
    }

    // Get the photography task
    const task = await base44.entities.PhotographyTask.get(task_id);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update LandlordProperty with media links
    if (task.landlord_property_id) {
      const updates = {
        photography_status: 'completed',
      };
      
      // Copy media links
      if (task.photos_link) updates.photos_url = task.photos_link;
      if (task.video_link) {
        updates.has_video_walkthrough = true;
        updates.video_walkthrough_url = task.video_link;
      }
      if (task.tour_3d_link) {
        updates.has_360_tour = true;
        updates.tour_360_url = task.tour_3d_link;
      }
      if (task.floor_plan_link) {
        updates.has_floor_plan = true;
        updates.floor_plan_url = task.floor_plan_link;
      }

      await base44.entities.LandlordProperty.update(task.landlord_property_id, updates);
      
      console.log('[syncPhotographyToProperty] Updated LandlordProperty ' + task.landlord_property_id + ' with media links');
    }

    return Response.json({ 
      ok: true, 
      task_id,
      landlord_property_id: task.landlord_property_id,
      synced: !!(task.photos_link || task.video_link || task.tour_3d_link)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});