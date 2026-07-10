import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

  const resp = await fetch(`${apiUrl}/instance/fetchInstances`, {
    headers: { apikey: apiKey },
  });
  const data = await resp.json();
  
  // Return just names and connection status
  const summary = data.map(i => ({ name: i.name, status: i.connectionStatus, owner: i.ownerJid, number: i.number }));
  return Response.json(summary);
});