import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * TEMPORARY DIAGNOSTIC FUNCTION — READ ONLY
 * 
 * Fetches the current Evolution API webhook subscription config for both instances:
 *   - erudite (business)
 *   - erudite_whatsapp (personal)
 * 
 * Does NOT modify anything. Use this to inspect current event subscriptions.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins can run diagnostics
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Read Evolution API credentials from env
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    // Fallback: check alternative env var names if the primary ones are missing
    const urlCandidates = ['EVOLUTION_API_URL', 'EVOLUTION_URL', 'EVOLUTION_BASE_URL'];
    const keyCandidates = ['EVOLUTION_API_KEY', 'EVOLUTION_GLOBAL_KEY', 'EVOLUTION_KEY'];

    const actualUrl = evolutionUrl || urlCandidates.map(k => Deno.env.get(k)).find(v => v);
    const actualKey = evolutionKey || keyCandidates.map(k => Deno.env.get(k)).find(v => v);

    // Report all EVOLUTION_* env vars for debugging
    const allEnvVars = Object.keys(Deno.env.toObject())
      .filter(k => k.toUpperCase().includes('EVOLUTION'))
      .reduce((acc, k) => {
        const val = Deno.env.get(k);
        acc[k] = val ? (val.length > 8 ? val.slice(0, 8) + '***' : '***') : null;
        return acc;
      }, {});

    if (!actualUrl || !actualKey) {
      return Response.json({
        error: 'Evolution API credentials not found in environment',
        available_evolution_env_vars: allEnvVars,
        looked_for_url: urlCandidates,
        looked_for_key: keyCandidates,
      }, { status: 500 });
    }

    const instances = ['erudite', 'erudite_whatsapp'];
    const results = {};

    for (const instance of instances) {
      try {
        const webhookUrl = `${actualUrl}/webhook/find/${instance}`;
        console.log(`[diagEvolutionWebhookConfig] Fetching: ${webhookUrl}`);

        const response = await fetch(webhookUrl, {
          method: 'GET',
          headers: {
            'apikey': actualKey,
            'Content-Type': 'application/json',
          },
        });

        const status = response.status;
        let data = null;
        let errorText = null;

        try {
          data = await response.json();
        } catch {
          errorText = await response.text();
        }

        results[instance] = {
          requested_url: webhookUrl,
          http_status: status,
          response: data,
          raw_error: errorText,
          // Extract key fields for quick viewing
          webhook_url: data?.webhook?.url || data?.url || null,
          events: data?.webhook?.events || data?.events || [],
          enabled: data?.webhook?.enabled ?? data?.enabled ?? null,
        };
      } catch (err) {
        results[instance] = {
          error: err.message || String(err),
          stack: err.stack || null,
        };
      }
    }

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      evolution_url_used: actualUrl,
      available_evolution_env_vars: allEnvVars,
      instances: results,
    });
  } catch (error) {
    console.error('[diagEvolutionWebhookConfig] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});