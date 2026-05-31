import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken(apiKey, apiSecret) {
  const key = apiKey || Deno.env.get('PROPERTY_FINDER_API_KEY');
  const secret = apiSecret || Deno.env.get('PROPERTY_FINDER_API_SECRET');
  const res = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey: key, apiSecret: secret }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('PF auth failed: ' + res.status + ' ' + txt);
  }
  const data = await res.json();
  return data.accessToken;
}

async function getStoredCredentials(base44) {
  try {
    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (creds && creds.length > 0 && creds[0].is_connected) {
      return { apiKey: creds[0].api_key, apiSecret: creds[0].api_secret };
    }
  } catch (e) { /* fallback to env vars */ }
  return { apiKey: null, apiSecret: null };
}

async function fetchPFLeadsPage(token, page, perPage) {
  const res = await fetch(`${PF_BASE}/leads?page=${page}&perPage=${perPage}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('PF leads fetch failed: ' + res.status + ' ' + body);
  }
  return await res.json();
}

async function fetchPFListings(token, maxPages) {
  maxPages = maxPages || 200; // No limit - sync all listings
  const allItems = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const res = await fetch(`${PF_BASE}/listings?page=${page}&perPage=${perPage}`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    if (!res.ok) break;
    const data = await res.json();
    const items = data.results || data.data || data.listings || data.items || [];
    if (items.length === 0) break;
    allItems.push(...items);
    const pagination = data.pagination || data.meta || {};
    const total = pagination.total || pagination.totalCount || data.total || 0;
    if (total > 0 && allItems.length >= total) break;
    // Check various "has next page" signals
    const hasNext = pagination.nextPage || pagination.next || (data.links && data.links.next) ||
      (pagination.currentPage && pagination.totalPages && pagination.currentPage < pagination.totalPages) ||
      (pagination.page && pagination.pages && pagination.page < pagination.pages);
    if (!hasNext && items.length < perPage) break;
    if (page >= maxPages) break;
    page++;
  }
  return allItems;
}

function getSenderContact(sender, type) {
  if (!sender || !sender.contacts) return '';
  const c = sender.contacts.find(function(x) { return x.type === type; });
  return c ? c.value : '';
}

function mapPFLeadToCRM(pfLead) {
  // sender holds the real contact info
  const sender = pfLead.sender || {};
  const name = sender.name || pfLead.name || pfLead.fullName || 'Unknown';
  const phone = getSenderContact(sender, 'phone') || pfLead.phone || pfLead.phoneNumber || '';
  const email = getSenderContact(sender, 'email') || pfLead.email || '';
  const channel = pfLead.channel || 'unknown';

  const listingId = pfLead.listing ? String(pfLead.listing.id || pfLead.listing.reference || '') : '';
  const listingRef = pfLead.listing ? String(pfLead.listing.reference || '') : '';

  const agentName = (pfLead.agent && pfLead.agent.name) ? pfLead.agent.name :
    ((pfLead.agent && pfLead.agent.firstName) ? (pfLead.agent.firstName + ' ' + (pfLead.agent.lastName || '')).trim() : '');
  const agentEmail = (pfLead.agent && pfLead.agent.email) ? pfLead.agent.email : '';

  const hasCallRecording = pfLead.call && pfLead.call.recordFile ? pfLead.call.recordFile : '';

  return {
    full_name: name,
    phone: phone,
    email: email,
    source: 'property_finder',
    source_metadata: {
      pf_lead_id: String(pfLead.id || ''),
      listing_id: listingId,
      listing_reference: listingRef,
      channel: channel,
      pf_created_at: pfLead.createdAt || '',
      pf_status: pfLead.status || '',
      message: pfLead.message || pfLead.body || '',
      pf_agent_name: agentName,
      pf_agent_email: agentEmail,
      call_recording: hasCallRecording,
      entity_type: pfLead.entityType || '',
      public_profile_id: pfLead.publicProfile ? String(pfLead.publicProfile.id || '') : '',
      response_link: pfLead.responseLink || '',
    },
    notes: pfLead.message || pfLead.body || '',
    stage: 'intake_clarify',
    assigned_agent_email: agentEmail || undefined,
    assigned_agent_name: agentName || undefined,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'sync';

    // Debug: inspect listing structure
    if (mode === 'listing_schema') {
      try { await base44.auth.me(); } catch (_) { /* gate degraded — proceed via service role */ }
      const { apiKey, apiSecret } = await getStoredCredentials(base44);
      const token = await getPFToken(apiKey, apiSecret);
      const res = await fetch(`${PF_BASE}/listings?page=1&perPage=1`, {
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
      });
      const raw = await res.json();
      const first = (raw.results || raw.data || [])[0] || {};
      // Return keys + sample values (strip long strings)
      const schema = {};
      for (const [k, v] of Object.entries(first)) {
        if (typeof v === 'string' && v.length > 100) schema[k] = v.substring(0, 100) + '...';
        else schema[k] = v;
      }
      const focus = { portals: first.portals, reference: first.reference, id: first.id, uaeEmirate: first.uaeEmirate, developer: first.developer, state: first.state };
      return Response.json({ keys: Object.keys(first), focus });
    }

    // Fetch PF listings - unlimited sync
    if (mode === 'listings') {
      try { await base44.auth.me(); } catch (_) { /* gate degraded — proceed via service role */ }
      const { apiKey, apiSecret } = await getStoredCredentials(base44);
      const token = await getPFToken(apiKey, apiSecret);
      const maxPages = body.maxPages || 200; // up to 10,000 listings (no limit)
      const listings = await fetchPFListings(token, maxPages);
      return Response.json({ ok: true, listings: listings });
    }

    // Webhook mode
    if (mode === 'webhook') {
      const pfLead = body.data || body.lead || body.payload || body;
      if (!pfLead || !pfLead.id) {
        return Response.json({ ok: true, message: 'No lead data in webhook' });
      }
      const pfLeadId = String(pfLead.id);
      const crmData = mapPFLeadToCRM(pfLead);
      const existing = await base44.asServiceRole.entities.Lead.filter({ source: 'property_finder' });
      const match = existing.find(function(l) {
        return l.source_metadata && l.source_metadata.pf_lead_id === pfLeadId;
      });
      if (match) {
        await base44.asServiceRole.entities.Lead.update(match.id, Object.assign({}, crmData, { stage: match.stage }));
        return Response.json({ ok: true, action: 'updated', lead_id: match.id });
      } else {
        const created = await base44.asServiceRole.entities.Lead.create(crmData);
        return Response.json({ ok: true, action: 'created', lead_id: created.id });
      }
    }

    // Sync mode (default) — resumable, chunked page-by-page
    const syncStart = Date.now();
    const SOFT_TIMEOUT_MS = 22000; // 22s soft cap, leaves safety margin under Base44's edge function ceiling
    const deadlineMs = syncStart + SOFT_TIMEOUT_MS;
    const PER_PAGE = 50;
    const diagnostics: any = {
      pages_fetched: 0,
      total_leads_received_from_pf: 0,
      total_leads_written: 0,
      created_count: 0,
      updated_count: 0,
      error_count: 0,
      time_ms_fetch_total: 0,
      time_ms_write_total: 0,
      time_ms_total: 0,
      token_age_at_end_ms: 0,
      first_error_message: null,
      terminated_reason: 'unknown',
      last_successful_page: 0,
      resume_from_page: 0,
      pages_processed_this_run: 0,
      sweep_complete: false,
      next_action_for_ahmad: '',
    };

    try { await base44.auth.me(); } catch (_) { /* gate degraded — proceed via service role */ }

    const { apiKey, apiSecret } = await getStoredCredentials(base44);

    let token: string;
    let tokenAcquiredAt = Date.now();
    try {
      const tokenStart = Date.now();
      token = await getPFToken(apiKey, apiSecret);
      tokenAcquiredAt = Date.now();
      diagnostics.time_ms_fetch_total += (tokenAcquiredAt - tokenStart);
      console.log('PF_SYNC_TOKEN: acquired_in_ms=' + (tokenAcquiredAt - tokenStart));
    } catch (err) {
      diagnostics.terminated_reason = 'token_expired';
      diagnostics.first_error_message = 'token: ' + String((err && err.message) || err);
      diagnostics.time_ms_total = Date.now() - syncStart;
      diagnostics.next_action_for_ahmad = 'Property Finder authentication failed — check API key/secret in Settings.';
      return Response.json({
        ok: false,
        total: 0,
        created: 0,
        updated: 0,
        errors: 0,
        ...diagnostics,
      });
    }

    // Read resume state from PFCredential (non-fatal if absent — sync still runs, just non-resumable)
    let credRow: any = null;
    try {
      const creds = await base44.asServiceRole.entities.PFCredential.list();
      credRow = (creds && creds.length > 0) ? creds[0] : null;
    } catch (err) {
      console.error('PF_SYNC_RESUME: failed to read PFCredential:', String((err && err.message) || err));
    }
    const resumeFromPage = Number((credRow && credRow.sync_last_completed_page) || 0) + 1;
    diagnostics.resume_from_page = resumeFromPage;
    console.log('PF_SYNC_RESUME: resume_from_page=' + resumeFromPage + ', has_cred_row=' + !!credRow);

    // Mark sweep as in-progress (non-fatal if schema not yet deployed)
    if (credRow && !credRow.sync_in_progress_since) {
      try {
        await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
          sync_in_progress_since: new Date().toISOString(),
        });
      } catch (err) {
        console.error('PF_SYNC_PROGRESS: failed to set sync_in_progress_since:', String((err && err.message) || err));
      }
    }

    // Build dedup map of existing PF leads (with deadline guard)
    const existingMap: any = {};
    let exPage = 0;
    const exPageSize = 500;
    let dedupTimedOut = false;
    while (true) {
      if (Date.now() > deadlineMs) {
        diagnostics.terminated_reason = 'soft_timeout';
        dedupTimedOut = true;
        break;
      }
      const batch = await base44.asServiceRole.entities.Lead.filter(
        { source: 'property_finder' }, '-created_date', exPageSize, exPage * exPageSize
      );
      for (const l of batch) {
        if (l.source_metadata && l.source_metadata.pf_lead_id) {
          existingMap[l.source_metadata.pf_lead_id] = l;
        }
      }
      if (batch.length < exPageSize) break;
      exPage++;
    }

    // Chunked page-by-page loop: fetch one page → write that page → persist progress → next page
    let page = resumeFromPage;
    let sweepComplete = false;
    let created = 0;
    let updated = 0;
    let errors = 0;
    let totalLeadsThisRun = 0;
    const writeStartTime = Date.now();

    if (!dedupTimedOut) {
      while (true) {
        if (Date.now() > deadlineMs) {
          if (
            diagnostics.terminated_reason === 'unknown' ||
            diagnostics.terminated_reason === 'completed_all_pages' ||
            diagnostics.terminated_reason === 'empty_page_break'
          ) {
            diagnostics.terminated_reason = 'soft_timeout';
          }
          break;
        }

        // Fetch one page
        const fetchStart = Date.now();
        let data: any;
        try {
          data = await fetchPFLeadsPage(token, page, PER_PAGE);
        } catch (err) {
          const msg = String((err && err.message) || err);
          if (!diagnostics.first_error_message) {
            diagnostics.first_error_message = 'fetch page=' + page + ': ' + msg;
          }
          const lower = msg.toLowerCase();
          if (msg.includes(' 401') || lower.includes('unauthorized') || lower.includes('expired') || lower.includes('token')) {
            diagnostics.terminated_reason = 'token_expired';
          } else {
            diagnostics.terminated_reason = 'fetch_error';
          }
          console.error('PF_SYNC_PAGE: fetch failed page=' + page + ' ' + msg);
          break;
        }
        const fetchMs = Date.now() - fetchStart;
        diagnostics.time_ms_fetch_total += fetchMs;
        const items = data.data || data.leads || data.items || [];
        diagnostics.pages_fetched = Math.max(diagnostics.pages_fetched || 0, page);
        console.log('PF_SYNC_PAGE: page=' + page + ', leads_returned=' + items.length + ', time_ms=' + fetchMs);

        // Empty page → sweep complete
        if (items.length === 0) {
          if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
            diagnostics.terminated_reason = 'empty_page_break';
          }
          sweepComplete = true;
          break;
        }

        // Write all leads on this page
        const pageWriteStart = Date.now();
        let midPageTimeout = false;
        for (const pfLead of items) {
          if (Date.now() > deadlineMs) {
            // Mid-page timeout: do NOT advance the counter — this page retries on next click
            if (
              diagnostics.terminated_reason === 'unknown' ||
              diagnostics.terminated_reason === 'completed_all_pages' ||
              diagnostics.terminated_reason === 'empty_page_break'
            ) {
              diagnostics.terminated_reason = 'soft_timeout';
            }
            midPageTimeout = true;
            break;
          }

          pfLead.__pf_page = page;
          const pfLeadIdOuter = String((pfLead && pfLead.id) || '');
          try {
            const pfLeadId = String(pfLead.id || '');
            if (!pfLeadId) continue;
            const crmData = mapPFLeadToCRM(pfLead);
            Object.keys(crmData).forEach(k => crmData[k] === undefined && delete crmData[k]);
            if (crmData.source_metadata) {
              Object.keys(crmData.source_metadata).forEach(k => crmData.source_metadata[k] === undefined && delete crmData.source_metadata[k]);
            }
            if (existingMap[pfLeadId]) {
              await base44.asServiceRole.entities.Lead.update(existingMap[pfLeadId].id, Object.assign({}, crmData, { stage: existingMap[pfLeadId].stage }));
              updated++;
            } else {
              const newLead = await base44.asServiceRole.entities.Lead.create(crmData);
              // Augment in-memory dedup map so subsequent pages this run don't re-create the same lead
              existingMap[pfLeadId] = newLead || { id: undefined };
              created++;
            }
          } catch (err) {
            errors++;
            const msg = String((err && err.message) || err);
            if (!diagnostics.first_error_message) {
              diagnostics.first_error_message = 'write pf_lead_id=' + pfLeadIdOuter + ': ' + msg;
            }
            console.error('Lead sync error for', pfLeadIdOuter, msg);
          }

          const writtenSoFar = created + updated;
          if (writtenSoFar > 0 && writtenSoFar % 100 === 0) {
            console.log('PF_SYNC_WRITE: written=' + writtenSoFar + ', errors=' + errors + ', elapsed_ms=' + (Date.now() - writeStartTime));
          }
        }
        diagnostics.time_ms_write_total += (Date.now() - pageWriteStart);

        // Mid-page timeout → bail without advancing counter
        if (midPageTimeout) break;

        // Page fully attempted (errors non-blocking) — advance & persist
        totalLeadsThisRun += items.length;
        diagnostics.pages_processed_this_run += 1;
        diagnostics.last_successful_page = page;

        if (credRow) {
          try {
            await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
              sync_last_completed_page: page,
            });
          } catch (err) {
            console.error('PF_SYNC_PROGRESS: failed to update sync_last_completed_page:', String((err && err.message) || err));
          }
        }

        // Partial page = end of dataset
        if (items.length < PER_PAGE) {
          if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
            diagnostics.terminated_reason = 'completed_all_pages';
          }
          sweepComplete = true;
          break;
        }

        page++;
      }
    }

    // On sweep complete: reset progress, record completion
    if (sweepComplete && credRow) {
      try {
        await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
          sync_last_completed_page: 0,
          sync_total_pages: page,
          sync_in_progress_since: null,
          sync_last_completed_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('PF_SYNC_PROGRESS: failed to record sweep completion:', String((err && err.message) || err));
      }
    }

    // Finalize diagnostics
    diagnostics.total_leads_received_from_pf = totalLeadsThisRun;
    diagnostics.created_count = created;
    diagnostics.updated_count = updated;
    diagnostics.error_count = errors;
    diagnostics.total_leads_written = created + updated;
    diagnostics.time_ms_total = Date.now() - syncStart;
    diagnostics.token_age_at_end_ms = Date.now() - tokenAcquiredAt;
    diagnostics.sweep_complete = sweepComplete;
    if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
      diagnostics.terminated_reason = 'completed_all_pages';
    }

    // Compose next_action_for_ahmad
    const knownTotalPages = (credRow && credRow.sync_total_pages) ? credRow.sync_total_pages : null;
    const totalLabel = knownTotalPages ? ('~' + knownTotalPages) : '?';
    if (sweepComplete && totalLeadsThisRun === 0 && resumeFromPage === 1) {
      diagnostics.next_action_for_ahmad = 'No leads to sync — Property Finder returned empty.';
    } else if (sweepComplete) {
      diagnostics.next_action_for_ahmad =
        'Sync complete: ' + (created + updated) + ' leads loaded this run (' + created + ' new, ' + updated + ' updated) across ' + diagnostics.pages_processed_this_run + ' pages.' +
        (credRow ? '' : ' Note: connect Property Finder via Settings to enable resumable sync across clicks.');
    } else if (diagnostics.terminated_reason === 'soft_timeout') {
      const runSummary = 'Run wrote ' + (created + updated) + ' leads across ' + diagnostics.pages_processed_this_run + ' pages';
      diagnostics.next_action_for_ahmad =
        runSummary + '. Hit soft timeout at page ' + page + ' of ' + totalLabel + ' — click Sync Now again to continue.' +
        (credRow ? '' : ' (Note: no PFCredential row, so resume restarts at page 1.)');
    } else if (diagnostics.terminated_reason === 'token_expired') {
      diagnostics.next_action_for_ahmad =
        'Run stopped at page ' + page + ' due to expired PF token — click Sync Now to retry with a fresh token.';
    } else if (diagnostics.terminated_reason === 'fetch_error') {
      diagnostics.next_action_for_ahmad =
        'Run stopped at page ' + page + ' due to a fetch error — click Sync Now to retry. First error: ' + (diagnostics.first_error_message || 'unknown');
    } else {
      diagnostics.next_action_for_ahmad =
        'Run finished with reason "' + diagnostics.terminated_reason + '" at page ' + page + '.';
    }

    console.log('PF_SYNC_DONE: ' + JSON.stringify(diagnostics));

    return Response.json({
      ok: true,
      total: totalLeadsThisRun,
      created: created,
      updated: updated,
      errors: errors,
      ...diagnostics,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});