import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lookupData, lookupUrl } = await req.json();
    
    let lookup;
    
    // Option 1: Direct JSON data (preferred - no rate limits)
    if (lookupData && typeof lookupData === 'object') {
      lookup = lookupData;
    } 
    // Option 2: Fetch from URL (GitHub/Google Drive/etc)
    else if (lookupUrl && typeof lookupUrl === 'string') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(lookupUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Erudite-CRM/1.0' }
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return Response.json({ error: `Failed to fetch: ${res.status} - ${body.slice(0, 150)}` }, { status: 500 });
        }
        lookup = await res.json();
      } catch (err) {
        clearTimeout(timeoutId);
        return Response.json({ error: `Fetch error: ${err.message}` }, { status: 500 });
      }
    } else {
      return Response.json({ error: 'Provide either lookupData (JSON object) or lookupUrl' }, { status: 400 });
    }

    if (typeof lookup !== 'object' || lookup === null || Array.isArray(lookup)) {
      return Response.json({ error: 'lookupData must be a JSON object { "<last9digits>": "<name>" }' }, { status: 400 });
    }

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

    // Load ALL WhatsAppConversation records with pagination and rate limit handling
    const ALL_CONVERSATIONS = [];
    let skip = 0;
    const LIMIT = 50;
    let attempts = 0;
    while (true) {
      try {
        const batch = await base44.entities.WhatsAppConversation.list(undefined, LIMIT, skip);
        if (!batch || batch.length === 0) break;
        ALL_CONVERSATIONS.push(...batch);
        skip += LIMIT;
        if (batch.length < LIMIT) break;
        attempts = 0; // reset on success
      } catch (err) {
        if (err.message && err.message.includes('Rate limit')) {
          attempts++;
          if (attempts > 5) {
            throw new Error(`Base44 rate limit exceeded after ${attempts} retries. Processed ${ALL_CONVERSATIONS.length} records so far.`);
          }
          await new Promise(r => setTimeout(r, 2000 * attempts));
          continue;
        }
        throw err;
      }
    }

    const results = {
      totalProcessed: ALL_CONVERSATIONS.length,
      matched: 0,
      noMatch: 0,
      updated: 0,
      samples: [],
    };

    const phoneUpdates = new Map();

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
      
      if (savedName && conv.saved_contact_name !== savedName) {
        updates.push({ id: conv.id, phone, savedName });
      }

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