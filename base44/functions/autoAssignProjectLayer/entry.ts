import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { lead_id } = await req.json();

    const lead = await base44.entities.Lead.get(lead_id);
    if (!lead || lead.project_layer) {
      // Already assigned or doesn't exist
      return Response.json({ success: true, assigned: false });
    }

    // Fetch project layer configs
    const projectLayers = await base44.entities.ProjectLayer.list();
    
    let assignedLayer = null;
    const budget = lead.budget_aed || 0;

    // Match budget to project layer
    for (const layer of projectLayers) {
      if (budget >= layer.budget_min_aed && budget <= layer.budget_max_aed) {
        assignedLayer = layer.layer_id;
        break;
      }
    }

    // Default to first layer if no match
    if (!assignedLayer && projectLayers.length > 0) {
      assignedLayer = projectLayers[0].layer_id;
    }

    if (assignedLayer) {
      await base44.entities.Lead.update(lead_id, {
        project_layer: assignedLayer
      });
      return Response.json({ success: true, assigned: true, layer: assignedLayer });
    }

    return Response.json({ success: true, assigned: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});