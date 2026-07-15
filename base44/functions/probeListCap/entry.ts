import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * probeListCap — one-off V4 diagnostic: what do .list()/.filter() actually return
 * for large limits? (Determines whether sweep functions see the whole landlord book.)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const [l5000, l1000, l200, f1000] = await Promise.all([
      svc.entities.Landlord.list('-updated_date', 5000).catch((e) => ({ err: String(e?.message || e) })),
      svc.entities.Landlord.list('-updated_date', 1000).catch((e) => ({ err: String(e?.message || e) })),
      svc.entities.Landlord.list('-updated_date', 200).catch((e) => ({ err: String(e?.message || e) })),
      svc.entities.Landlord.filter({}, '-updated_date', 1000).catch((e) => ({ err: String(e?.message || e) })),
    ]);
    const len = (x) => Array.isArray(x) ? x.length : x;
    return Response.json({
      list_5000: len(l5000),
      list_1000: len(l1000),
      list_200: len(l200),
      filter_1000: len(f1000),
    });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
