import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PREFIX_MAP = {
  "971": "AE", "966": "SA", "974": "QA", "973": "BH", "965": "KW",
  "968": "OM", "20": "EG", "44": "GB", "1": "US", "91": "IN", "92": "PK", "63": "PH"
};

function inferCountry(e164) {
  const num = e164.replace(/^\+/, "");
  for (const len of [3, 2, 1]) {
    if (PREFIX_MAP[num.slice(0, len)]) return PREFIX_MAP[num.slice(0, len)];
  }
  return null;
}

function computeSpamScore(lookup) {
  let s = 0;
  if (lookup?.line_type_intelligence?.type === "voip") s += 40;
  if (lookup?.line_type_intelligence?.type === "tollFree") s += 30;
  if (!lookup?.caller_name?.caller_name) s += 10;
  return Math.min(100, s);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone_e164 } = await req.json();
    if (!phone_e164) return Response.json({ error: 'phone_e164 required' }, { status: 400 });

    const country = inferCountry(phone_e164);

    // WhatsApp contacts check via Graph API
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const waApiBase = `https://graph.facebook.com/v18.0/${phoneNumberId}`;

    let isValid = false;
    try {
      const waCheck = await fetch(`${waApiBase}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ blocking: "wait", contacts: [phone_e164], force_check: true })
      }).then(r => r.json());
      isValid = waCheck?.contacts?.[0]?.status === "valid";
    } catch {
      // WA check failed — proceed without it
    }

    // Optional Twilio Lookup for carrier + spam
    const twilioSid = Deno.env.get("TWILIO_SID");
    const twilioToken = Deno.env.get("TWILIO_TOKEN");

    if (twilioSid && twilioToken) {
      try {
        const lookup = await fetch(
          `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone_e164)}?Fields=line_type_intelligence,caller_name`,
          { headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` } }
        ).then(r => r.json());

        return Response.json({
          is_valid_whatsapp: isValid,
          country_code: country,
          carrier: lookup?.line_type_intelligence?.carrier_name || null,
          phone_type: lookup?.line_type_intelligence?.type || "unknown",
          spam_score: computeSpamScore(lookup),
          caller_name: lookup?.caller_name?.caller_name || null
        });
      } catch {
        // Twilio unavailable — fall through to basic response
      }
    }

    return Response.json({
      is_valid_whatsapp: isValid,
      country_code: country,
      spam_score: 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});