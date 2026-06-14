import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Helper: normalize phone to last 9 digits
    const toLast9Digits = (phone) => {
      if (!phone) return null;
      let digits = String(phone).replace(/\D/g, '');
      digits = digits.replace(/^0+/, '');
      if (digits.startsWith('971')) {
        digits = digits.slice(3);
      }
      if (digits.length > 9) {
        digits = digits.slice(-9);
      }
      if (digits.length < 9) {
        return digits.length > 0 ? digits : null;
      }
      return digits;
    };

    // Test the specific phones from the screenshot
    const testPhones = ['+971506185310', '+971563679206', '+971526330035'];
    const results = testPhones.map(phone => ({
      original: phone,
      last9: toLast9Digits(phone),
    }));

    // Fetch lookup to check if these exist
    const lookupUrl = 'https://raw.githubusercontent.com/ahmadbadreddine198622-alt/erudite-crm/main/saved_names_lookup.json';
    const res = await fetch(lookupUrl);
    const lookup = await res.json();

    const withLookup = results.map(r => ({
      ...r,
      foundInLookup: !!lookup[r.last9],
      savedName: lookup[r.last9] || null,
    }));

    return Response.json({
      testResults: withLookup,
      lookupSize: Object.keys(lookup).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});