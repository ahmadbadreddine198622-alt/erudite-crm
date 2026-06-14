import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken() {
  const key = Deno.env.get('PROPERTY_FINDER_API_KEY');
  const secret = Deno.env.get('PROPERTY_FINDER_API_SECRET');
  const res = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey: key, apiSecret: secret }),
  });
  if (!res.ok) throw new Error('PF auth failed: ' + res.status);
  return (await res.json()).accessToken;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const token = await getPFToken();
  
  const res = await fetch(`${PF_BASE}/users`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  const json = await res.json();
  const users = json.data || json.results || [];
  
  const targetIds = [334076, 325576, 364258];
  
  const matches = users.filter(u => targetIds.includes(u.publicProfile?.id)).map(u => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    publicProfile_id: u.publicProfile?.id,
  }));
  
  const missing = targetIds.filter(id => !users.some(u => u.publicProfile?.id === id));
  
  return Response.json({
    timestamp: new Date().toISOString(),
    total_users_scanned: users.length,
    requested_publicProfile_ids: targetIds,
    found: matches,
    missing_from_users: missing,
    confirmation: {
      publicProfile_334076: matches.find(m => m.publicProfile_id === 334076) || 'NOT FOUND',
      publicProfile_325576: matches.find(m => m.publicProfile_id === 325576) || 'NOT FOUND',
      publicProfile_364258: matches.find(m => m.publicProfile_id === 364258) || 'NOT FOUND (CONFIRMED ABSENT)',
    },
  });
});