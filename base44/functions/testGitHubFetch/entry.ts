import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const lookupUrl = 'https://raw.githubusercontent.com/ahmadbadreddine198622-alt/erudite-crm/main/saved_names_lookup.json';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(lookupUrl, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'PropCRM-import/1.0' }
    });
    clearTimeout(timeoutId);
    
    const text = await res.text();
    
    return Response.json({
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
      bodyPreview: text.slice(0, 500),
      isHtml: text.trim().startsWith('<'),
      isJson: text.trim().startsWith('{') || text.trim().startsWith('['),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});