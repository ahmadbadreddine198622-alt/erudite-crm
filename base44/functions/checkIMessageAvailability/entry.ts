import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Normalize a phone number to E.164 (UAE default +971). Pass Apple ID emails through unchanged.
function normalizeAddress(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed.includes('@')) return trimmed;

  let digits = trimmed.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('971')) return '+' + digits;
  // Local UAE format starting with leading 0 (e.g. 0581806000) → +971581806000
  if (digits.startsWith('0')) return '+971' + digits.slice(1);
  // Bare local mobile (e.g. 581806000) → +971581806000
  return '+971' + digits;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id } = body;
    let address = body.phone || body.address;

    let landlord = null;
    if (landlord_id) {
      landlord = await base44.entities.Landlord.get(landlord_id).catch(() => null);
      if (!address && landlord) address = landlord.phone || landlord.whatsapp;
    }
    if (!address) {
      return Response.json({ error: 'No phone number found to check' }, { status: 400 });
    }
    address = normalizeAddress(address);

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';

    const checkedAt = new Date().toISOString();
    let status = 'error';
    let _error_detail = null;

    if (!serverUrl || !password) {
      if (landlord_id) {
        await base44.entities.Landlord.update(landlord_id, { imessage_status: 'error', imessage_checked_at: checkedAt }).catch(() => {});
      }
      return Response.json({ error: 'BlueBubbles server is not configured', imessage_status: 'error', imessage_checked_at: checkedAt }, { status: 500 });
    }

    try {
      const url = `${serverUrl}/api/v1/handle/availability/imessage?password=${encodeURIComponent(password)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const raw = await resp.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { raw }; }

      if (resp.ok) {
        // BlueBubbles returns { data: { available: true/false } } (shape can vary).
        const d = data?.data ?? data;
        const available = d?.available === true || d?.available === 'true' || d === true;
        status = available ? 'available' : 'not_available';
      } else {
        status = 'error';
        _error_detail = `BlueBubbles HTTP ${resp.status}`;
      }
    } catch (fetchErr) {
      status = 'error';
      // Most common cause: the BLUEBUBBLES_SERVER_URL tunnel (e.g. trycloudflare.com) has expired.
      _error_detail = `Cannot reach BlueBubbles server — ${String(fetchErr?.message || fetchErr)}`;
    }

    if (landlord_id) {
      await base44.entities.Landlord.update(landlord_id, {
        imessage_status: status,
        imessage_checked_at: checkedAt,
      }).catch(() => {});
    }

    return Response.json({ success: true, address, imessage_status: status, imessage_checked_at: checkedAt, error_detail: _error_detail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});