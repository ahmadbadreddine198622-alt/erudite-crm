import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Transport shim ONLY: fetches a prepared owner-registry JSON from a URL and
// forwards it verbatim to the existing, unmodified importOwnerRegistry function.
// Contains NO import / dedup / enrichment logic — all of that runs inside
// importOwnerRegistry. Exists solely because the registry payload (~3.5MB)
// cannot be inlined into the function-test tool call.
// Admin-only, matching importOwnerRegistry's own guard.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const fileUrl = String(body.file_url || '').trim();
    if (!fileUrl) return Response.json({ error: 'file_url is required' }, { status: 400 });
    const assignedAgentEmail = String(body.assigned_agent_email || '').trim().toLowerCase();
    if (!assignedAgentEmail) {
      return Response.json({ error: 'assigned_agent_email is required' }, { status: 400 });
    }
    const dryRun = body.dry_run !== false; // default ON, same as importOwnerRegistry

    const r = await fetch(fileUrl);
    if (!r.ok) return Response.json({ error: `Failed to fetch registry: ${r.status} ${r.statusText}` }, { status: 502 });
    const registry = await r.json();
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
      return Response.json({ error: 'Fetched file is not a registry object keyed by sheet name' }, { status: 400 });
    }

    // Optional: forward only a single project's sheet. Keeps each invocation
    // within the function wall-clock limit for very large registries. The
    // import logic itself is unchanged — importOwnerRegistry just receives a
    // smaller registry object.
    let forwardRegistry = registry;
    const onlyProject = String(body.only_project || '').trim();
    if (onlyProject) {
      const key = Object.keys(registry).find((k) => k.toLowerCase() === onlyProject.toLowerCase());
      if (!key) {
        return Response.json({ error: `only_project "${onlyProject}" not found in registry sheets` }, { status: 400 });
      }
      forwardRegistry = { [key]: registry[key] };
    }

    const result = await base44.functions.invoke('importOwnerRegistry', {
      registry: forwardRegistry,
      dry_run: dryRun,
      assigned_agent_email: assignedAgentEmail,
    });
    const out = result?.data ?? result;
    return Response.json(out, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});