import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// importOwnerRegistry — admin-only, strictly add-only, idempotent bulk import of a
// prepared owner-registry JSON file into the Landlord entity.
//
// Input: { registry: { "<sheetName>": [ <Landlord fields...>, ... ], ... }, dry_run?: boolean }
// dry_run defaults to TRUE (report only, no writes).
//
// Dedup key: canonicalProject | normalizedUnit | normalizedName
//   - normalizedName  = uppercase, collapse whitespace
//   - normalizedUnit  = uppercase, strip whitespace
//   - canonicalProject maps Marina Gate variants to "Marina Gate 1" / "Marina Gate 2"
// If several existing records share a key, the most complete one (phone > email >
// additional_phones) is the match target.
//
// For an existing match: NEVER overwrite — only fill empty phone/whatsapp/email/project_id
// and append unseen additional_phones / additional_emails. Empty patch = "already complete".
// For no match: create (bulk, 100/batch).
// Re-running the same file → ~everything reports "already complete".

async function withRetry(fn, attempts = 5) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const is429 = e?.status === 429 || /rate limit|429|too many requests/i.test(msg);
      if (!is429 || i === attempts) throw e;
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, i - 1)));
    }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const dryRun = body.dry_run !== false; // default ON
    const registry = body.registry;

    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
      return Response.json({ error: 'registry must be a JSON object keyed by sheet name' }, { status: 400 });
    }

    // The importer must explicitly choose which agent the imported landlord
    // records are assigned to. No silent default to the logged-in importer.
    const assignedAgentEmail = String(body.assigned_agent_email || '').trim().toLowerCase();
    if (!assignedAgentEmail) {
      return Response.json({ error: 'assigned_agent_email is required — choose an agent before importing' }, { status: 400 });
    }

    // --- Flatten incoming records ---
    const incoming = [];
    for (const [sheet, records] of Object.entries(registry)) {
      if (!Array.isArray(records)) continue;
      for (const r of records) {
        if (r && typeof r === 'object') incoming.push({ ...r, _sheet: sheet });
      }
    }

    if (!incoming.length) {
      return Response.json({ ok: true, dry_run: dryRun, per_project: {}, totals: { created: 0, enriched: 0, already_complete: 0, errors: 0, total_incoming: 0 }, errors: [] });
    }

    // --- Canonical project + normalization helpers ---
    const PROJECT_CANON = [
      { re: /^THE RESIDENCES? AT MARINA GATE 1$/i, c: 'Marina Gate 1' },
      { re: /^THE RESIDENCES? AT MARINA GATE I$/i, c: 'Marina Gate 1' },
      { re: /^THE RESIDENCES? AT MARINA GATE 2$/i, c: 'Marina Gate 2' },
      { re: /^THE RESIDENCES? AT MARINA GATE II$/i, c: 'Marina Gate 2' },
    ];
    const canonProject = (raw) => {
      const s = String(raw || '').trim().toUpperCase();
      for (const p of PROJECT_CANON) if (p.re.test(s)) return p.c;
      return s;
    };
    const normName = (raw) => String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const normUnit = (raw) => String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    const buildKey = (proj, unit, name) => `${canonProject(proj)}|${normUnit(unit)}|${normName(name)}`;
    const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

    const SR = base44.asServiceRole;

    // --- 1. Load ALL existing landlords (paginate via created_date cursor) ---
    const all = [];
    const seenIds = new Set();
    let lastDate = null;
    for (let page = 0; page < 30; page++) {
      const query = lastDate ? { created_date: { $lt: lastDate } } : {};
      const res = await SR.entities.Landlord.filter(query, '-created_date', 5000);
      const rows = Array.isArray(res) ? res : (res.items || []);
      if (!rows.length) break;
      let fresh = 0;
      let pageOldest = null;
      for (const r of rows) {
        if (!seenIds.has(r.id)) { seenIds.add(r.id); all.push(r); fresh++; }
        if (r.created_date && (!pageOldest || r.created_date < pageOldest)) pageOldest = r.created_date;
      }
      if (pageOldest) lastDate = pageOldest;
      if (fresh === 0 || rows.length < 5000) break;
    }

    // --- 2. Build index — most complete record per key ---
    const completeness = (r) => {
      let s = 0;
      if (r.phone && String(r.phone).trim()) s += 4;
      if (r.email && String(r.email).trim()) s += 2;
      if (Array.isArray(r.additional_phones) && r.additional_phones.length) s += 1;
      return s;
    };
    const index = new Map(); // key -> { rec, sc }
    for (const r of all) {
      const key = buildKey(r.project_name, r.unit_reference, r.full_name_en || r.full_name || '');
      const sc = completeness(r);
      const ex = index.get(key);
      if (!ex || sc > ex.sc) index.set(key, { rec: r, sc });
    }

    // --- 3. Process incoming ---
    const perProject = {};
    const bucket = (proj) => {
      const k = canonProject(proj) || '(no project)';
      if (!perProject[k]) perProject[k] = { created: 0, enriched: 0, already_complete: 0, errors: 0 };
      return perProject[k];
    };

    const toCreate = []; // { rec, project }
    const toUpdate = []; // { id, patch, project }
    const errors = [];

    for (const rec of incoming) {
      const projBucket = bucket(rec.project_name);
      try {
        const name = rec.full_name_en || '';
        const key = buildKey(rec.project_name, rec.unit_reference, name);
        const ex = index.get(key);

        if (!ex) {
          toCreate.push({ rec, project: canonProject(rec.project_name) || '(no project)' });
          projBucket.created++;
          index.set(key, { rec, sc: completeness(rec) });
          continue;
        }

        const existing = ex.rec;
        const patch = {};

        // (a) fill phone if currently empty
        if (rec.phone && String(rec.phone).trim() && !(existing.phone && String(existing.phone).trim())) {
          patch.phone = rec.phone;
        }
        // fill whatsapp if currently empty
        if (rec.whatsapp && String(rec.whatsapp).trim() && !(existing.whatsapp && String(existing.whatsapp).trim())) {
          patch.whatsapp = rec.whatsapp;
        }
        // (b) append unseen additional_phones
        if (Array.isArray(rec.additional_phones) && rec.additional_phones.length) {
          const have = new Set([
            ...((existing.phone && String(existing.phone).trim()) ? [onlyDigits(existing.phone)] : []),
            ...(Array.isArray(existing.additional_phones) ? existing.additional_phones.map(onlyDigits) : []),
          ]);
          const unseen = rec.additional_phones.filter((p) => p && !have.has(onlyDigits(p)));
          if (unseen.length) {
            patch.additional_phones = [...(Array.isArray(existing.additional_phones) ? existing.additional_phones : []), ...unseen];
          }
        }
        // (c) fill email if currently empty
        if (rec.email && String(rec.email).trim() && !(existing.email && String(existing.email).trim())) {
          patch.email = rec.email;
        }
        // (d) append unseen additional_emails (case-insensitive compare)
        if (Array.isArray(rec.additional_emails) && rec.additional_emails.length) {
          const haveE = new Set([
            ...((existing.email && String(existing.email).trim()) ? [String(existing.email).trim().toLowerCase()] : []),
            ...(Array.isArray(existing.additional_emails) ? existing.additional_emails.map((e) => String(e).trim().toLowerCase()) : []),
          ]);
          const unseenE = rec.additional_emails.filter((e) => e && !haveE.has(String(e).trim().toLowerCase()));
          if (unseenE.length) {
            patch.additional_emails = [...(Array.isArray(existing.additional_emails) ? existing.additional_emails : []), ...unseenE];
          }
        }
        // (e) set project_id only if currently empty
        if (rec.project_id && String(rec.project_id).trim() && !(existing.project_id && String(existing.project_id).trim())) {
          patch.project_id = rec.project_id;
        }
        // (f) assign to the chosen agent only if the existing record has no agent
        if (assignedAgentEmail && !(existing.assigned_agent_email && String(existing.assigned_agent_email).trim())) {
          patch.assigned_agent_email = assignedAgentEmail;
        }

        if (Object.keys(patch).length === 0) {
          projBucket.already_complete++;
        } else {
          toUpdate.push({ id: existing.id, patch, project: canonProject(rec.project_name) || '(no project)' });
          projBucket.enriched++;
          // reflect enrichment in the in-memory index so same-file dupes see updated state
          Object.assign(existing, patch);
        }
      } catch (e) {
        errors.push({ name: rec.full_name_en, project: rec.project_name, error: String(e?.message || e) });
        projBucket.errors++;
      }
    }

    const alreadyComplete = incoming.length - toCreate.length - toUpdate.length - errors.length;

    // --- 4. Writes (skipped in dry-run) ---
    let createdCount = 0;
    let enrichedCount = 0;

    if (!dryRun) {
      // Creates — bulkCreate 100/batch, one-by-one fallback for per-record error attribution
      for (let i = 0; i < toCreate.length; i += 100) {
        const batch = toCreate.slice(i, i + 100);
        const payload = batch.map(({ rec }) => ({
          full_name_en: rec.full_name_en,
          first_name: rec.first_name,
          last_name: rec.last_name,
          phone: rec.phone || '',
          whatsapp: rec.whatsapp,
          email: rec.email,
          additional_phones: Array.isArray(rec.additional_phones) ? rec.additional_phones : [],
          additional_emails: Array.isArray(rec.additional_emails) ? rec.additional_emails : [],
          unit_reference: rec.unit_reference,
          project_name: rec.project_name,
          project_id: rec.project_id,
          lead_type: rec.lead_type,
          source: rec.source,
          stage: rec.stage,
          assigned_agent_email: assignedAgentEmail,
          notes_internal: rec.notes_internal,
        }));
        let created;
        try {
          const res = await withRetry(() => SR.entities.Landlord.bulkCreate(payload));
          created = Array.isArray(res) ? res : (res.items || []);
        } catch (e) {
          created = [];
          for (const { rec, project } of batch) {
            try {
              const r = await withRetry(() => SR.entities.Landlord.create({
                full_name_en: rec.full_name_en, first_name: rec.first_name, last_name: rec.last_name,
                phone: rec.phone || '', whatsapp: rec.whatsapp, email: rec.email,
                additional_phones: Array.isArray(rec.additional_phones) ? rec.additional_phones : [],
                additional_emails: Array.isArray(rec.additional_emails) ? rec.additional_emails : [],
                unit_reference: rec.unit_reference, project_name: rec.project_name, project_id: rec.project_id,
                lead_type: rec.lead_type, source: rec.source, stage: rec.stage,
                assigned_agent_email: assignedAgentEmail, notes_internal: rec.notes_internal,
              }));
              created.push(r);
            } catch (e2) {
              errors.push({ name: rec.full_name_en, project, error: String(e2?.message || e2) });
              const b = perProject[project] || (perProject[project] = { created: 0, enriched: 0, already_complete: 0, errors: 0 });
              b.created--; b.errors++;
            }
          }
        }
        createdCount += created.length;
      }

      // Updates — bulkUpdate 500/batch, one-by-one fallback
      for (let i = 0; i < toUpdate.length; i += 500) {
        const batch = toUpdate.slice(i, i + 500);
        const payload = batch.map((u) => ({ id: u.id, ...u.patch }));
        let ok = 0;
        try {
          await withRetry(() => SR.entities.Landlord.bulkUpdate(payload));
          ok = batch.length;
        } catch (e) {
          for (const u of batch) {
            try {
              await withRetry(() => SR.entities.Landlord.update(u.id, u.patch));
              ok++;
            } catch (e2) {
              errors.push({ id: u.id, project: u.project, patch: u.patch, error: String(e2?.message || e2) });
              const b = perProject[u.project] || (perProject[u.project] = { created: 0, enriched: 0, already_complete: 0, errors: 0 });
              b.enriched--; b.errors++;
            }
          }
        }
        enrichedCount += ok;
      }
    } else {
      createdCount = toCreate.length;
      enrichedCount = toUpdate.length;
    }

    const totals = {
      created: createdCount,
      enriched: enrichedCount,
      already_complete: alreadyComplete,
      errors: errors.length,
      total_incoming: incoming.length,
    };

    return Response.json({ ok: true, dry_run: dryRun, per_project: perProject, totals, errors: errors.slice(0, 500) });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});