import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called by scheduled automation every hour — wakes all active deals
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const activeDeals = await base44.asServiceRole.entities.Deal.filter({});
    const toProcess = activeDeals.filter(d =>
      !["won","lost"].includes(d.stage) &&
      (Date.now() - new Date(d.last_orchestrator_run_at || 0)) / 3.6e6 >= 1
    );

    const results = [];
    // Process in batches of 10
    for (let i = 0; i < toProcess.length; i += 10) {
      const batch = toProcess.slice(i, i + 10);
      const batchResults = await Promise.allSettled(
        batch.map(deal =>
          base44.asServiceRole.functions.invoke("auroraOrchestrator", { deal_id: deal.id })
        )
      );
      results.push(...batchResults);
    }

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    return Response.json({ processed: toProcess.length, succeeded, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});