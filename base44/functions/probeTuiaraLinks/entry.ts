import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const tasks = await base44.entities.PhotographyTask.filter({
      landlord_property_id: '6a1f1047ea6b459fb8120cff',
    });
    return Response.json(tasks.map(t => ({
      task_stage: t.task_stage,
      tour_3d_link: t.tour_3d_link,
      video_link: t.video_link,
      photos_link: t.photos_link,
    })));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});