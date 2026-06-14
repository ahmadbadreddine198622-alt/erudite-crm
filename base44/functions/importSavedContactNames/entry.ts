import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lookupUrl } = await req.json();
    if (!lookupUrl || typeof lookupUrl !== 'string') {
      return Response.json({ error: 'Missing lookupUrl in payload' }, { status: 400 });
    }

    // Step 1: Fetch the lookup JSON with 15s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let lookup;
    try {
      const res = await fetch(lookupUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return Response.json({ error: `Failed to fetch lookup: ${res.status} ${res.statusText}` }, { status: 500 });
      }
      lookup = await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      return Response.json({ error: `Fetch timeout or error: ${err.message}` }, { status: 500 });
    }

    if (typeof lookup !== 'object' || lookup === null || Array.isArray(lookup)) {
      return Response.json({ error: 'Lookup must be a JSON object { "<last9digits>": "<name>" }' }, { status: 400 });
    }

    // Helper: normalize phone to last 9 digits
    const toLast9Digits = (phone) => {
      if (!phone) return null;
      // Strip all non-digits
      let digits = String(phone).replace(/\D/g, '');
      // Strip leading zeros
      digits = digits.replace(/^0+/, '');
      // If starts with 971 (UAE code), strip it to get local number
      if (digits.startsWith('971')) {
        digits = digits.slice(3);
      }
      // If starts with 60 (Malaysia) or other codes, we still want last 9
      // Take last 9 digits
      if (digits.length > 9) {
        digits = digits.slice(-9);
      }
      // If less than 9, pad or return as-is (won't match)
      if (digits.length < 9) {
        return digits.length > 0 ? digits : null;
      }
      return digits;
    };

    // Step 2: Load ALL WhatsAppConversation records with pagination
    const ALL_CONVERSATIONS = [];
    let skip = 0;
    const LIMIT = 100;
    while (true) {
      const batch = await base44.entities.WhatsAppConversation.list(undefined, LIMIT, skip);
      if (!batch || batch.length === 0) break;
      ALL_CONVERSATIONS.push(...batch);
      skip += LIMIT;
      if (batch.length < LIMIT) break;
    }

    // Step 3 & 4: Match and update
    const results = {
      totalProcessed: ALL_CONVERSATIONS.length,
      matched: 0,
      noMatch: 0,
      updated: 0,
      samples: [],
    };

    // Track which phones we've already updated to avoid duplicate writes
    const phoneUpdates = new Map(); // last9digits -> saved_name

    // First pass: determine what each phone should have
    for (const conv of ALL_CONVERSATIONS) {
      const phone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(phone);
      if (!last9) {
        results.noMatch++;
        continue;
      }
      const savedName = lookup[last9] || null;
      phoneUpdates.set(last9, savedName);
    }

    // Second pass: apply updates
    const updates = [];
    for (const conv of ALL_CONVERSATIONS) {
      const phone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(phone);
      if (!last9) continue;

      const savedName = phoneUpdates.get(last9) || null;
      
      // Only update if we have a name AND it's different from current
      if (savedName && conv.saved_contact_name !== savedName) {
        updates.push({
          id: conv.id,
          phone,
          savedName,
        });
      }

      // Track for report
      if (savedName) {
        results.matched++;
        if (results.samples.length < 10) {
          results.samples.push({ phone, saved_contact_name: savedName });
        }
      } else {
        results.noMatch++;
      }
    }

    // Batch update all conversations
    for (const update of updates) {
      await base44.entities.WhatsAppConversation.update(update.id, { saved_contact_name: update.savedName });
      results.updated++;
    }

    return Response.json({
      summary: {
        totalProcessed: results.totalProcessed,
        matched: results.matched,
        noMatch: results.noMatch,
        updated: results.updated,
      },
      samples: results.samples,
      lookupSize: Object.keys(lookup).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});