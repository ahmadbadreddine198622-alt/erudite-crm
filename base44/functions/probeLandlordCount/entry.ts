// probeLandlordCount — THROWAWAY, read-only.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const ll = await base44.entities.Landlord.list();
    return Response.json({ landlord_count: ll.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});