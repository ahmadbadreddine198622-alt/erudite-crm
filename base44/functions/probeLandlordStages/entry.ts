// probeLandlordStages — THROWAWAY diagnostic.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const ll = await base44.entities.Landlord.list('-updated_date', 500);
    
    // Count by stage
    const byStage = {};
    ll.forEach(l => {
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
    });
    
    return Response.json({
      total: ll.length,
      by_stage: byStage,
      sample: ll.slice(0, 3).map(l => ({ id: l.id, stage: l.stage, full_name: l.full_name_en })),
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});