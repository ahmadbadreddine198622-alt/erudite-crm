import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { create as createJwt } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';

/**
 * Send a PDF to multiple signers via DocuSign.
 *
 * Body: {
 *   form_type: "F" | "A" | "B" | "I" | "MOU" | "custom",
 *   pdf_url: string,           // public URL of the PDF we generated
 *   subject: string,           // email subject
 *   message?: string,          // email body
 *   signers: [{ role, name, email, phone? }],
 *   lead_id?, deal_id?, property_id?, offer_id?
 * }
 *
 * Returns: { envelope_id, signature_envelope_id, signing_urls: { [email]: url } }
 */

async function getDocuSignJWT(cred: any) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    iss: cred.integration_key,
    sub: cred.user_id,
    aud: cred.base_uri.includes('demo') ? 'account-d.docusign.com' : 'account.docusign.com',
    iat,
    exp: iat + 3600,
    scope: 'signature impersonation'
  };

  const pemKey = cred.rsa_private_key || Deno.env.get('DOCUSIGN_RSA_PRIVATE_KEY');
  if (!pemKey) throw new Error('Missing DocuSign RSA private key');

  // Import PKCS#8 PEM private key
  const keyDer = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const keyBuf = Uint8Array.from(atob(keyDer), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const assertion = await createJwt({ alg: 'RS256', typ: 'JWT' }, payload, cryptoKey);

  const aud = cred.base_uri.includes('demo') ? 'account-d.docusign.com' : 'account.docusign.com';
  const tokenRes = await fetch(`https://${aud}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`DocuSign token: ${tokenRes.status} ${txt}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { form_type, pdf_url, subject, message, signers, lead_id, deal_id, property_id, offer_id } = await req.json();
    if (!pdf_url || !Array.isArray(signers) || signers.length === 0) {
      return Response.json({ error: 'pdf_url and signers required' }, { status: 400 });
    }

    const cred = (await base44.asServiceRole.entities.DocuSignCredential.list())?.[0];
    if (!cred || !cred.is_connected) return Response.json({ error: 'DocuSign not connected' }, { status: 400 });

    const accessToken = await getDocuSignJWT(cred);

    // 1. Fetch the PDF
    const pdfRes = await fetch(pdf_url);
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF at ${pdf_url}`);
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    // 2. Build envelope payload
    const envelope = {
      emailSubject: subject || `Please sign: ${form_type}`,
      emailBlurb: message || 'Please review and sign this document at your earliest convenience.',
      status: 'sent',
      documents: [{
        documentId: '1',
        name: `${form_type}.pdf`,
        fileExtension: 'pdf',
        documentBase64: pdfBase64
      }],
      recipients: {
        signers: signers.map((s: any, i: number) => ({
          email: s.email,
          name: s.name,
          recipientId: String(i + 1),
          routingOrder: String(i + 1),
          tabs: {
            signHereTabs: [{
              anchorString: `/sn${i + 1}/`,
              anchorXOffset: '0',
              anchorYOffset: '0',
              anchorUnits: 'pixels',
              anchorIgnoreIfNotPresent: 'true'
            }],
            dateSignedTabs: [{
              anchorString: `/dt${i + 1}/`,
              anchorIgnoreIfNotPresent: 'true'
            }]
          }
        }))
      },
      eventNotification: {
        url: `${new URL(req.url).origin}/functions/docusignWebhook`,
        loggingEnabled: 'true',
        requireAcknowledgment: 'true',
        envelopeEvents: [
          { envelopeEventStatusCode: 'sent' },
          { envelopeEventStatusCode: 'delivered' },
          { envelopeEventStatusCode: 'completed' },
          { envelopeEventStatusCode: 'declined' },
          { envelopeEventStatusCode: 'voided' }
        ]
      }
    };

    const dsRes = await fetch(
      `${cred.base_uri}/restapi/v2.1/accounts/${cred.account_id}/envelopes`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      }
    );
    if (!dsRes.ok) {
      const txt = await dsRes.text();
      return Response.json({ error: `DocuSign envelope: ${dsRes.status} ${txt}` }, { status: dsRes.status });
    }
    const dsData = await dsRes.json();

    const envelopeRecord = await base44.asServiceRole.entities.SignatureEnvelope.create({
      docusign_envelope_id: dsData.envelopeId,
      form_type,
      lead_id,
      deal_id,
      property_id,
      offer_id,
      subject,
      status: 'sent',
      signers: signers.map((s: any) => ({ ...s, status: 'sent' })),
      source_pdf_url: pdf_url,
      sent_at: new Date().toISOString(),
      created_by: user.email
    });

    if (lead_id) {
      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id,
          type: 'email',
          direction: 'outbound',
          title: `Sent ${form_type} for signature via DocuSign`,
          description: `Recipients: ${signers.map((s: any) => `${s.name} <${s.email}>`).join(', ')}`,
          source: 'docusign',
          metadata: { envelope_id: dsData.envelopeId, signature_envelope_id: envelopeRecord.id }
        });
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({
      ok: true,
      envelope_id: dsData.envelopeId,
      signature_envelope_id: envelopeRecord.id,
      status: dsData.status
    });
  } catch (error: any) {
    console.error('docusignSendForSignature error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
