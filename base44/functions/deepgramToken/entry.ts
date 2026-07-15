import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * deepgramToken — returns a credential for the browser to open a Deepgram
 * streaming WebSocket (`wss://api.deepgram.com/v1/listen`, subprotocol
 * ['token', <key>]).
 *
 * Deepgram's subprotocol accepts either a short-lived minted key OR the API
 * key directly. This account's API key lacks the `keys:write` scope needed to
 * mint temporary keys, so we return the raw API key — which the subprotocol
 * accepts without any extra scope. The key is delivered only to authenticated
 * app users over HTTPS.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!apiKey) return Response.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 });

    return Response.json({ token: apiKey });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});