import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url } = body;
    if (!url) return Response.json({ error: 'url required' }, { status: 400 });

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
    });
    if (!res.ok) return Response.json({ error: 'Failed to fetch image: ' + res.status }, { status: 400 });

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return Response.json({ base64: `data:${contentType};base64,${base64}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});