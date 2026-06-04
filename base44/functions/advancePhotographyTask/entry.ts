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

    // Automation: When task reaches "handed_to_listing", advance landlord from "photos_videos" to "photographer_scheduling"
    if (new_stage === 'handed_to_listing' && task.landlord_id) {
      const landlord = await base44.entities.Landlord.get(task.landlord_id);
      if (landlord && landlord.stage === 'photos_videos') {
        await base44.entities.Landlord.update(task.landlord_id, {
          stage: 'photographer_scheduling',
          stage_entered_at: new Date().toISOString(),
        });

        // Send notification email to listing admin
        const ADMIN_EMAIL = "ahmad@erudite-estate.com";
        try {
          const mediaLinks = [];
          if (task.tour_3d_link) mediaLinks.push(`<a href="${task.tour_3d_link}" target="_blank">3D Tour</a>`);
          if (task.video_link) mediaLinks.push(`<a href="${task.video_link}" target="_blank">Video</a>`);
          if (task.photos_link) mediaLinks.push(`<a href="${task.photos_link}" target="_blank">Photos</a>`);

          const body = `
            <h2>New Listing Ready for Verification</h2>
            <p>A unit has completed photography and is ready for document verification and listing creation.</p>
            <table style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Landlord:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${landlord.full_name_en || landlord.full_name || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Project:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${landlord.project_name || 'N/A'}</td>
              </tr>
              ${landlord.unit_reference ? `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Unit:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${landlord.unit_reference}</td>
              </tr>
              ` : ''}
              ${mediaLinks.length > 0 ? `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Media:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${mediaLinks.join(' | ')}</td>
              </tr>
              ` : ''}
            </table>
            <p style="color: #666; font-size: 12px;">Erudite CRM</p>
          `;

          await base44.integrations.Core.SendEmail({
            to: ADMIN_EMAIL,
            subject: `New listing ready for verification — ${landlord.full_name_en || landlord.full_name || 'Unknown'}`,
            body,
            from_name: "Erudite CRM",
          });
        } catch (emailError) {
          console.error('Failed to send admin notification email:', emailError);
          // Continue without failing the stage update
        }
      }
    }

    return Response.json({ ok: true, task_id, new_stage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});