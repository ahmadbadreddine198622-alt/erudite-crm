import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const wabaId = Deno.env.get('WHATSAPP_WABA_ID');

  if (!accessToken) return Response.json({ error: 'Missing WHATSAPP_ACCESS_TOKEN' }, { status: 500 });
  if (!wabaId) return Response.json({ error: 'Missing WHATSAPP_WABA_ID' }, { status: 500 });

  let allTemplates = [];
  let url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,language,category,components&limit=200&access_token=${accessToken}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || 'Failed to fetch templates', details: data }, { status: 500 });
    }
    allTemplates = allTemplates.concat(data.data || []);
    url = data.paging?.next || null;
  }

  const approved = allTemplates.filter(t => t.status === 'APPROVED').map(t => {
    const bodyComp = t.components?.find(c => c.type === 'BODY');
    const headerComp = t.components?.find(c => c.type === 'HEADER');
    const footerComp = t.components?.find(c => c.type === 'FOOTER');
    return {
      name: t.name,
      language: t.language,
      category: t.category,
      body: bodyComp?.text || '',
      header: headerComp?.text || '',
      footer: footerComp?.text || '',
      components: t.components || [],
    };
  });

  return Response.json({ templates: approved, total: approved.length });
});