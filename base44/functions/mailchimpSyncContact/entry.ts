import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Push a Lead into a Mailchimp audience (creates or updates).
 *
 * Body: { lead_id, audience_id?, tags?, status? }
 *   - audience_id defaults to MailchimpCredential.default_audience_id
 *   - status: "subscribed" | "pending" (double opt-in) | "unsubscribed"
 *
 * Returns: { ok, mailchimp_member_id, status }
 *
 * Idempotent — Mailchimp keys members by MD5(lowercase(email)).
 */

async function md5(str: string): Promise<string> {
  // Mailchimp requires MD5 of lowercased email as the member identifier.
  const buf = new TextEncoder().encode(str.toLowerCase().trim());
  const hash = await crypto.subtle.digest('SHA-256', buf); // We'll use a manual MD5 implementation
  // crypto.subtle doesn't support MD5 — implement minimal MD5 below
  return md5Hex(str.toLowerCase().trim());
}

// Minimal MD5 implementation for Deno (Mailchimp API mandate)
function md5Hex(input: string): string {
  function leftRotate(x: number, c: number): number { return ((x << c) | (x >>> (32 - c))) >>> 0; }
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];

  const bytes = new TextEncoder().encode(input);
  const len = bytes.length;
  const blockCount = ((len + 8) >> 6) + 1;
  const padded = new Uint8Array(blockCount * 64);
  padded.set(bytes);
  padded[len] = 0x80;
  const bitLen = len * 8;
  new DataView(padded.buffer).setUint32(padded.length - 8, bitLen, true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let i = 0; i < blockCount; i++) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) M[j] = new DataView(padded.buffer, i * 64 + j * 4).getUint32(0, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j++) {
      let F, g;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      F = (F + A + K[j] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + leftRotate(F, S[j])) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const toHex = (n: number) => {
    let h = '';
    for (let i = 0; i < 4; i++) h += ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return h;
  };
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, audience_id, tags = [], status = 'subscribed' } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.Lead.get(lead_id);
    if (!lead?.email) return Response.json({ error: 'Lead has no email' }, { status: 400 });

    const cred = (await base44.asServiceRole.entities.MailchimpCredential.list())?.[0];
    if (!cred || !cred.is_connected) return Response.json({ error: 'Mailchimp not connected' }, { status: 400 });

    const apiKey = cred.api_key || Deno.env.get('MAILCHIMP_API_KEY');
    if (!apiKey) return Response.json({ error: 'Mailchimp API key missing' }, { status: 500 });

    const dc = cred.server_prefix || apiKey.split('-')[1];
    const listId = audience_id || cred.default_audience_id;
    if (!listId) return Response.json({ error: 'audience_id required' }, { status: 400 });

    const memberId = md5Hex(lead.email.toLowerCase().trim());
    const finalStatus = cred.double_optin ? 'pending' : status;

    const payload = {
      email_address: lead.email,
      status_if_new: finalStatus,
      status: finalStatus,
      merge_fields: {
        FNAME: lead.name?.split(' ')[0] || '',
        LNAME: lead.name?.split(' ').slice(1).join(' ') || '',
        PHONE: lead.phone || '',
        STAGE: lead.stage || '',
        SOURCE: lead.source || '',
        BUDGET: String(lead.budget_aed || ''),
        LOCATION: (lead.preferred_locations || []).join(', '),
        TYPE: lead.type || ''
      },
      tags: [...(tags || []), ...(lead.tags || [])]
    };

    const res = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${memberId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const err = await res.text();
      await base44.asServiceRole.entities.MailchimpCredential.update(cred.id, { last_error: err.slice(0, 500) });
      return Response.json({ error: `Mailchimp: ${res.status} ${err}` }, { status: res.status });
    }

    const data = await res.json();

    // Sync tags via separate endpoint (full tag list, not delta)
    if (tags.length > 0) {
      await fetch(
        `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${memberId}/tags`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tags: tags.map((t: string) => ({ name: t, status: 'active' })) })
        }
      );
    }

    return Response.json({
      ok: true,
      mailchimp_member_id: memberId,
      status: data.status,
      audience_id: listId
    });
  } catch (error: any) {
    console.error('mailchimpSyncContact error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
