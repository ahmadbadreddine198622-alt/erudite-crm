import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Diagnostic: compare Evolution webhook configuration across agent instances.
// Goal — find why WhatsApp history syncs for Adeyemi but not for other agents.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

    // Inspect Adeyemi (syncs) + the wa_<number> agent instances (don't sync).
    // Also return the full event list from the first working instance so the
    // fix can replicate it exactly.
    const targets = [
      'Adeyemi Opeyemi', 'wa_971526615434', 'wa_971585732603', 'wa_971559972095',
      'wa_971559508545', 'wa_971521279665', 'Samy', 'Malik', 'Yana Kim', 'Abduhafiz',
    ];

    const results = {};
    let referenceEvents = null;
    for (const inst of targets) {
      try {
        const r = await fetch(`${apiUrl}/webhook/find/${encodeURIComponent(inst)}`, {
          headers: { apikey: apiKey },
        });
        const raw = await r.text();
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) { parsed = raw; }
        if (r.status === 404) {
          results[inst] = { http_status: 404, has_webhook: false, note: 'instance not found or no webhook' };
        } else {
          const url = parsed?.url || null;
          const enabled = parsed?.enabled ?? null;
          const events = Array.isArray(parsed?.events) ? parsed.events : [];
          if (url && !referenceEvents) referenceEvents = events;
          results[inst] = {
            http_status: r.status,
            has_webhook: !!url,
            webhook_url: url,
            enabled,
            has_messages_upsert: events.includes('MESSAGES_UPSERT'),
            events_count: events.length,
          };
        }
      } catch (e) {
        results[inst] = { error: String(e?.message || e) };
      }
    }

    return Response.json({ ok: true, reference_events: referenceEvents, results });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
});