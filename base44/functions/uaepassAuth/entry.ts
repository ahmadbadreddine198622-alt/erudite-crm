import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Start a UAE Pass OAuth2 KYC flow for a specific lead.
 *
 * Body: { lead_id }
 * Returns: { authorize_url, kyc_record_id, state }
 *
 * The agent presents the authorize_url to the lead (WhatsApp / SMS / email);
 * the lead authenticates via the UAE Pass app/SMS OTP; UAE Pass redirects to
 * our /functions/uaepassCallback, which exchanges the code, fetches profile,
 * and marks the KYCRecord verified.
 */

function randomState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

    const cred = (await base44.asServiceRole.entities.UAEPassCredential.list())?.[0];
    if (!cred || !cred.is_connected) {
      return Response.json({ error: 'UAE Pass not connected' }, { status: 400 });
    }

    const state = randomState();

    const kyc = await base44.asServiceRole.entities.KYCRecord.create({
      lead_id,
      method: 'uae_pass',
      status: 'pending_user',
      session_token: state
    });

    const base = cred.environment === 'prod' ? 'https://id.uaepass.ae' : 'https://stg-id.uaepass.ae';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: cred.client_id,
      scope: cred.scope || 'urn:uae:digitalid:profile:general',
      state,
      redirect_uri: cred.redirect_uri,
      acr_values: 'urn:safelayer:tws:policies:authentication:level:low',
      ui_locales: 'en'
    });

    const authorizeUrl = `${base}/idshub/authorize?${params.toString()}`;

    return Response.json({
      ok: true,
      authorize_url: authorizeUrl,
      kyc_record_id: kyc.id,
      state
    });
  } catch (error: any) {
    console.error('uaepassAuth error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
