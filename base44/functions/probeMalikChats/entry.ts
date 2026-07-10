import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const instance = 'Malik';

    const results = {};

    const tryPage = async (label, body) => {
      const r = await fetch(`${apiUrl}/chat/findMessages/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify(body),
      });
      const txt = await r.text();
      results[label] = { status: r.status, snippet: txt.slice(0, 200) };
    };

    await tryPage('page_1_empty', {});
    await tryPage('page_2_offset_1', { page: { limit: 50, offset: 1 } });
    await tryPage('page_2_offset_50', { page: { limit: 50, offset: 50 } });
    await tryPage('page_2_page_2', { page: { limit: 50, page: 2 } });
    await tryPage('page_2_skip_50', { skip: 50, limit: 50 });
    await tryPage('page_cursor', { cursor: { limit: 50, skip: 50 } });

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});