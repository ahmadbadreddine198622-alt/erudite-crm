import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!accessToken || !phoneNumberId) {
    return Response.json({ error: 'Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID' }, { status: 500 });
  }

  // Resolve WABA ID: try via phone number first, then fall back to /me businesses
  let wabaId = null;

  // Attempt 1: phone number -> owned_whatsapp_business_account
  const phoneRes = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=whatsapp_business_account,id&access_token=${accessToken}`
  );
  const phoneData = await phoneRes.json();
  if (phoneData.whatsapp_business_account?.id) {
    wabaId = phoneData.whatsapp_business_account.id;
  }

  // Attempt 2: look up via /me?fields=businesses then walk to owned_whatsapp_business_accounts
  if (!wabaId) {
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=businesses{owned_whatsapp_business_accounts{id}}&access_token=${accessToken}`
    );
    const meData = await meRes.json();
    const firstWaba = meData.businesses?.data?.[0]?.owned_whatsapp_business_accounts?.data?.[0];
    if (firstWaba?.id) wabaId = firstWaba.id;
  }

  // Attempt 3: use the app ID as the WABA source (system user tokens sometimes work with app_id)
  if (!wabaId) {
    const appRes = await fetch(
      `https://graph.facebook.com/v21.0/app?fields=owned_whatsapp_business_accounts{id}&access_token=${accessToken}`
    );
    const appData = await appRes.json();
    const firstWaba = appData.owned_whatsapp_business_accounts?.data?.[0];
    if (firstWaba?.id) wabaId = firstWaba.id;
  }

  if (!wabaId) {
    return Response.json({ error: 'Could not resolve WABA ID. Grant whatsapp_business_management permission or set WHATSAPP_WABA_ID secret.', details: phoneData }, { status: 500 });
  }

  // Fetch all approved templates from Meta
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

  // Only return APPROVED templates
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