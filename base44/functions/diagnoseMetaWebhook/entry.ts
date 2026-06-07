import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * diagnoseMetaWebhook - Logs incoming Meta webhook attempts
 * Use this to debug why messages subscription fails
 */

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const method = req.method;
  
  console.log(`[diagnoseMetaWebhook] ${method} ${url.pathname}`);
  console.log(`[diagnoseMetaWebhook] Query params:`, Object.fromEntries(url.searchParams));
  console.log(`[diagnoseMetaWebhook] Headers:`, Object.fromEntries(req.headers));
  
  // GET: Meta verification
  if (method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expectedToken = Deno.env.get('META_VERIFY_TOKEN');
    
    console.log(`[diagnoseMetaWebhook] GET: mode=${mode}, token=${token}, expected=${expectedToken}, challenge=${challenge}`);
    console.log(`[diagnoseMetaWebhook] Match: ${token === expectedToken}`);
    
    if (mode === 'subscribe' && token === expectedToken && challenge) {
      console.log(`[diagnoseMetaWebhook] ✅ Verification SUCCESS - returning challenge`);
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    
    console.log(`[diagnoseMetaWebhook] ❌ Verification FAILED`);
    return new Response('Forbidden', { status: 403 });
  }
  
  // POST: Test event or real message
  if (method === 'POST') {
    const secret = url.searchParams.get('secret');
    const expectedSecret = Deno.env.get('META_WEBHOOK_SECRET');
    
    console.log(`[diagnoseMetaWebhook] POST secret=${secret}, expected=${expectedSecret}, match=${secret === expectedSecret}`);
    
    let body;
    try {
      body = await req.json();
      console.log(`[diagnoseMetaWebhook] Body:`, JSON.stringify(body, null, 2));
    } catch (e) {
      console.log(`[diagnoseMetaWebhook] Body parse error:`, e.message);
    }
    
    // Always return 200 for POST so Meta doesn't disable webhook
    console.log(`[diagnoseMetaWebhook] ✅ Returning 200 OK`);
    return new Response('OK', { status: 200 });
  }
  
  return new Response('Method not allowed', { status: 405 });
});