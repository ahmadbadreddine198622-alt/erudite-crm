import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Temporary one-off bulk import function for The Edge A landlord records.
// Secret-gated; delete after import completes.
const IMPORT_SECRET = 'edgeA-7f3k9x2mQ84pL1vZ';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }
  if (body?.secret !== IMPORT_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const records = body?.records;
  if (!Array.isArray(records) || records.length === 0 || records.length > 100) {
    return new Response(JSON.stringify({ error: 'records must be array of 1-100' }), { status: 400 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const created = await base44.asServiceRole.entities.Landlord.bulkCreate(records);
    return new Response(JSON.stringify({ ok: true, created: Array.isArray(created) ? created.length : records.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
});
