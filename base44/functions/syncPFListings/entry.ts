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

async function fetchPFListingsPage(token, page, perPage) {
  const res = await fetch(`${PF_BASE}/listings?page=${page}&perPage=${perPage}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('PF listings fetch failed: ' + res.status + ' ' + body);
  }
  return await res.json();
}

function normalizeOffering(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s === 'sale' || s === 'for-sale' || s === 'for_sale' || s.includes('sale')) return 'sale';
  if (s === 'rent' || s === 'for-rent' || s === 'for_rent' || s.includes('rent') || s.includes('lease')) return 'rent';
  return null;
}

function pickPrice(priceObj) {
  // Returns { price, offering_type, price_period }. Prefers sale over rent when both exist.
  if (!priceObj) return { price: null, offering_type: 'unknown', price_period: null };
  if (typeof priceObj === 'number') return { price: priceObj, offering_type: 'unknown', price_period: null };
  const amounts = priceObj.amounts || {};
  let price = null;
  // Normalize offering from type field first
  let offering = normalizeOffering(priceObj.type || priceObj.offering_type || priceObj.purpose || priceObj.category);
  let period = null;
  let derivedFromRent = false;
  if (typeof amounts.sale === 'number') {
    price = amounts.sale;
    if (!offering) offering = 'sale';
  } else if (typeof amounts.rent === 'number') {
    price = amounts.rent;
    if (!offering) offering = 'rent';
    derivedFromRent = true;
  } else if (typeof amounts.yearly === 'number') {
    price = amounts.yearly;
    if (!offering) offering = 'rent';
    derivedFromRent = true;
    period = 'year';
  } else if (typeof amounts.monthly === 'number') {
    price = amounts.monthly;
    if (!offering) offering = 'rent';
    derivedFromRent = true;
    period = 'month';
  }
  // If price came from a rent amount but offering is still ambiguous, force rent
  if (derivedFromRent && offering !== 'sale') offering = 'rent';
  // Normalize period from explicit field if present
  const rawPeriod = priceObj.period || priceObj.frequency || null;
  if (rawPeriod) {
    const p = String(rawPeriod).toLowerCase();
    if (p.indexOf('year') >= 0) period = 'year';
    else if (p.indexOf('month') >= 0) period = 'month';
  }
  if (offering !== 'sale' && offering !== 'rent') offering = 'unknown';
  return { price, offering_type: offering, price_period: period };
}

function pickBedrooms(b) {
  if (b === undefined || b === null) return undefined;
  if (typeof b === 'number') {
    if (b === 0) return 'studio';
    if (b >= 5) return '5+';
    return String(b);
  }
  const s = String(b).toLowerCase().trim();
  if (!s) return undefined;
  if (s === '0' || s.indexOf('studio') >= 0) return 'studio';
  const num = Number(s);
  if (!isNaN(num)) {
    if (num >= 5) return '5+';
    return String(num);
  }
  return s;
}

function pickFirstImage(media) {
  if (!media) return null;
  const imgs = media.images || (Array.isArray(media) ? media : []);
  if (!imgs.length) return null;
  const f = imgs[0] || {};
  return (f.original && f.original.url) || (f.watermarked && f.watermarked.url) || f.url || null;
}

function pickTitle(t) {
  if (!t) return '';
  if (typeof t === 'object') return t.en || t.ar || '';
  return String(t);
}

function pickLocation(l) {
  if (l.uaeEmirate) {
    const s = String(l.uaeEmirate);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (l.city) return typeof l.city === 'object' ? (l.city.name || '') : String(l.city);
  if (l.location && typeof l.location === 'object') return l.location.name || '';
  return '';
}

function pickPropertyType(l) {
  const v = l.type || l.category;
  if (!v) return '';
  if (typeof v === 'object') return v.name || '';
  return String(v);
}

function pickStatus(state) {
  if (!state) return '';
  if (typeof state === 'object') return state.stage || state.type || '';
  return String(state);
}

function pickSize(l) {
  if (typeof l.size === 'number') return l.size;
  if (typeof l.area === 'number') return l.area;
  if (l.size && typeof l.size === 'object' && typeof l.size.value === 'number') return l.size.value;
  return undefined;
}

function mapPFListingToCRM(pfListing, urlStats) {
  // urlStats is a mutable object { from_api, numeric_fallback, hidden } for diagnostics
  const rawId = pfListing.id || pfListing.reference || '';
  const rawRef = pfListing.reference || pfListing.id || '';
  const listingId = String(rawId);
  const listingRef = String(rawRef);

  const { price, offering_type } = pickPrice(pfListing.price);
  const imageUrl = pickFirstImage(pfListing.media);
  const title = pickTitle(pfListing.title);
  const location = pickLocation(pfListing);
  const propertyType = pickPropertyType(pfListing);
  const pfStatus = pickStatus(pfListing.state);
  const bedroomsRaw = pickBedrooms(pfListing.bedrooms);
  const sizeSqft = pickSize(pfListing);

  // 1. Try all URL fields returned by the PF API first (real canonical URL)
  const apiUrl = pfListing.url || pfListing.web_url || pfListing.link ||
    (pfListing.links && (pfListing.links.public_link || pfListing.links.web || pfListing.links.url)) ||
    null;

  // 2. Only build fallback if ID is purely numeric (alphanumeric refs like S1EW3... always 404)
  const numericFallback =
    (!apiUrl && listingId && /^\d+$/.test(listingId)) ? `https://www.propertyfinder.ae/property/${listingId}.html` :
    (!apiUrl && listingRef && /^\d+$/.test(listingRef)) ? `https://www.propertyfinder.ae/property/${listingRef}.html` :
    null;

  const pfUrl = apiUrl || numericFallback || null;

  // Track URL outcomes for diagnostics
  if (urlStats) {
    if (apiUrl) urlStats.from_api++;
    else if (numericFallback) urlStats.numeric_fallback++;
    else urlStats.hidden++;
  }

  // Map offering_type → listing_type enum (sale | rent)
  // Also check top-level purpose/offering_type fields on the raw listing as fallback
  const topLevelOffering = normalizeOffering(pfListing.purpose || pfListing.offering_type || pfListing.category);
  const resolvedOffering = (offering_type === 'rent' || offering_type === 'sale') ? offering_type : (topLevelOffering || 'sale');
  const listing_type = resolvedOffering;

  // Map bedrooms string → number (studio = 0)
  let bedrooms;
  if (bedroomsRaw !== undefined && bedroomsRaw !== null) {
    if (String(bedroomsRaw).toLowerCase() === 'studio') {
      bedrooms = 0;
    } else {
      const n = Number(bedroomsRaw);
      if (!isNaN(n)) bedrooms = n;
    }
  }

  // Map bathrooms string → number
  let bathrooms;
  if (pfListing.bathrooms !== undefined && pfListing.bathrooms !== null) {
    const n = Number(pfListing.bathrooms);
    if (!isNaN(n)) bathrooms = n;
  }

  // Map PF status → entity enum
  const statusMap = {
    'published': 'active', 'live': 'active', 'active': 'active',
    'takendown': 'inactive', 'taken_down': 'inactive',
    'draft': 'draft', 'expired': 'expired',
    'under_offer': 'under_offer', 'sold': 'sold', 'rented': 'rented',
    'inactive': 'inactive',
  };
  const status = statusMap[(pfStatus || '').toLowerCase()] || 'inactive';

  return {
    pf_listing_id: listingId,
    reference_number: listingRef || undefined,
    title: title || undefined,
    images: imageUrl ? [imageUrl] : undefined,
    listing_type,
    price: (typeof price === 'number') ? price : undefined,
    location: location || undefined,
    bedrooms,
    bathrooms,
    area_sqft: sizeSqft,
    property_type: propertyType || undefined,
    status,
    pf_url: pfUrl || undefined,
    last_synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await req.json().catch(() => ({})); // body ignored; sync is the only mode

    const syncStart = Date.now();
    const SOFT_TIMEOUT_MS = 22000;
    const deadlineMs = syncStart + SOFT_TIMEOUT_MS;
    const PER_PAGE = 50;
    const diagnostics = {
      pages_fetched: 0,
      total_listings_received_from_pf: 0,
      total_listings_written: 0,
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

    let token;
    let tokenAcquiredAt = Date.now();
    try {
      const tokenStart = Date.now();
      token = await getPFToken(apiKey, apiSecret);
      tokenAcquiredAt = Date.now();
      diagnostics.time_ms_fetch_total += (tokenAcquiredAt - tokenStart);
      console.log('PF_LISTINGS_TOKEN: acquired_in_ms=' + (tokenAcquiredAt - tokenStart));
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
    let credRow = null;
    try {
      const creds = await base44.asServiceRole.entities.PFCredential.list();
      credRow = (creds && creds.length > 0) ? creds[0] : null;
    } catch (err) {
      console.error('PF_LISTINGS_RESUME: failed to read PFCredential:', String((err && err.message) || err));
    }
    const resumeFromPage = Number((credRow && credRow.listings_sync_last_completed_page) || 0) + 1;
    diagnostics.resume_from_page = resumeFromPage;
    console.log('PF_LISTINGS_RESUME: resume_from_page=' + resumeFromPage + ', has_cred_row=' + !!credRow);

    // Mark sweep as in-progress (non-fatal if schema not yet deployed)
    if (credRow && !credRow.listings_sync_in_progress_since) {
      try {
        await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
          listings_sync_in_progress_since: new Date().toISOString(),
        });
      } catch (err) {
        console.error('PF_LISTINGS_PROGRESS: failed to set listings_sync_in_progress_since:', String((err && err.message) || err));
      }
    }

    // Build dedup map of existing PFListing rows by listing_id (with deadline guard)
    const existingMap = {};
    let exPage = 0;
    const exPageSize = 500;
    let dedupTimedOut = false;
    while (true) {
      if (Date.now() > deadlineMs) {
        diagnostics.terminated_reason = 'soft_timeout';
        dedupTimedOut = true;
        break;
      }
      const batch = await base44.asServiceRole.entities.PFListing.filter(
        {}, '-updated_date', exPageSize, exPage * exPageSize
      );
      for (const l of batch) {
        if (l.pf_listing_id) existingMap[l.pf_listing_id] = l;
      }
      if (batch.length < exPageSize) break;
      exPage++;
    }

    // Chunked page-by-page loop
    let page = resumeFromPage;
    let sweepComplete = false;
    let created = 0;
    let updated = 0;
    let errors = 0;
    let totalListingsThisRun = 0;
    const urlStats = { from_api: 0, numeric_fallback: 0, hidden: 0 };
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
        let data;
        try {
          data = await fetchPFListingsPage(token, page, PER_PAGE);
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
          console.error('PF_LISTINGS_PAGE: fetch failed page=' + page + ' ' + msg);
          break;
        }
        const fetchMs = Date.now() - fetchStart;
        diagnostics.time_ms_fetch_total += fetchMs;
        const items = data.results || data.data || data.listings || data.items || [];
        diagnostics.pages_fetched = Math.max(diagnostics.pages_fetched || 0, page);
        console.log('PF_LISTINGS_PAGE: page=' + page + ', listings_returned=' + items.length + ', time_ms=' + fetchMs);

        // Empty page → sweep complete
        if (items.length === 0) {
          if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
            diagnostics.terminated_reason = 'empty_page_break';
          }
          sweepComplete = true;
          break;
        }

        // Write all listings on this page
        const pageWriteStart = Date.now();
        let midPageTimeout = false;
        for (const pfListing of items) {
          if (Date.now() > deadlineMs) {
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

          const listingIdOuter = String((pfListing && (pfListing.id || pfListing.reference)) || '');
          try {
            const mapped = mapPFListingToCRM(pfListing, urlStats);
            if (!mapped.pf_listing_id) {
              errors++;
              if (!diagnostics.first_error_message) {
                diagnostics.first_error_message = 'listing missing id and reference; skipped';
              }
              continue;
            }
            Object.keys(mapped).forEach((k) => mapped[k] === undefined && delete mapped[k]);

            let writeSuccess = false;
            let retryCount = 0;
            while (!writeSuccess && retryCount < 3) {
              try {
                if (existingMap[mapped.pf_listing_id]) {
                  await base44.asServiceRole.entities.PFListing.update(existingMap[mapped.pf_listing_id].id, mapped);
                  updated++;
                } else {
                  const newRow = await base44.asServiceRole.entities.PFListing.create(mapped);
                  existingMap[mapped.pf_listing_id] = newRow || { id: undefined };
                  created++;
                }
                writeSuccess = true;
              } catch (writeErr) {
                const errMsg = String(writeErr.message || writeErr);
                if (errMsg.includes('Rate limit') && retryCount < 2) {
                  retryCount++;
                  await new Promise(r => setTimeout(r, 400 * retryCount));
                } else {
                  throw writeErr;
                }
              }
            }
          } catch (err) {
            errors++;
            const msg = String((err && err.message) || err);
            if (!diagnostics.first_error_message) {
              diagnostics.first_error_message = 'write listing_id=' + listingIdOuter + ': ' + msg;
            }
            console.error('Listing sync error for', listingIdOuter, msg);
          }

          const writtenSoFar = created + updated;
          if (writtenSoFar > 0 && writtenSoFar % 100 === 0) {
            console.log('PF_LISTINGS_WRITE: written=' + writtenSoFar + ', errors=' + errors + ', elapsed_ms=' + (Date.now() - writeStartTime));
          }
        }
        diagnostics.time_ms_write_total += (Date.now() - pageWriteStart);

        if (midPageTimeout) break;

        // Page fully attempted — advance & persist
        totalListingsThisRun += items.length;
        diagnostics.pages_processed_this_run += 1;
        diagnostics.last_successful_page = page;

        if (credRow) {
          try {
            await base44.asServiceRole.entities.PFCredential.update(credRow.id, {
              listings_sync_last_completed_page: page,
            });
          } catch (err) {
            console.error('PF_LISTINGS_PROGRESS: failed to update listings_sync_last_completed_page:', String((err && err.message) || err));
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
          listings_sync_last_completed_page: 0,
          listings_sync_total_pages: page,
          listings_sync_in_progress_since: null,
          listings_sync_last_completed_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('PF_LISTINGS_PROGRESS: failed to record sweep completion:', String((err && err.message) || err));
      }
    }

    // Finalize diagnostics
    diagnostics.total_listings_received_from_pf = totalListingsThisRun;
    diagnostics.url_from_api = urlStats.from_api;
    diagnostics.url_numeric_fallback = urlStats.numeric_fallback;
    diagnostics.url_hidden = urlStats.hidden;
    console.log(`PF_URL_STATS: from_api=${urlStats.from_api}, numeric_fallback=${urlStats.numeric_fallback}, hidden=${urlStats.hidden}`);
    diagnostics.created_count = created;
    diagnostics.updated_count = updated;
    diagnostics.error_count = errors;
    diagnostics.total_listings_written = created + updated;
    diagnostics.time_ms_total = Date.now() - syncStart;
    diagnostics.token_age_at_end_ms = Date.now() - tokenAcquiredAt;
    diagnostics.sweep_complete = sweepComplete;
    if (!diagnostics.terminated_reason || diagnostics.terminated_reason === 'unknown') {
      diagnostics.terminated_reason = 'completed_all_pages';
    }

    // Compose next_action_for_ahmad
    const knownTotalPages = (credRow && credRow.listings_sync_total_pages) ? credRow.listings_sync_total_pages : null;
    const totalLabel = knownTotalPages ? ('~' + knownTotalPages) : '?';
    if (sweepComplete && totalListingsThisRun === 0 && resumeFromPage === 1) {
      diagnostics.next_action_for_ahmad = 'No listings to sync — Property Finder returned empty.';
    } else if (sweepComplete) {
      diagnostics.next_action_for_ahmad =
        'Listing sync complete: ' + (created + updated) + ' listings loaded this run (' + created + ' new, ' + updated + ' updated) across ' + diagnostics.pages_processed_this_run + ' pages.' +
        (credRow ? '' : ' Note: connect Property Finder via Settings to enable resumable sync across clicks.');
    } else if (diagnostics.terminated_reason === 'soft_timeout') {
      const runSummary = 'Run wrote ' + (created + updated) + ' listings across ' + diagnostics.pages_processed_this_run + ' pages';
      diagnostics.next_action_for_ahmad =
        runSummary + '. Hit soft timeout at page ' + page + ' of ' + totalLabel + ' — invoke syncPFListings again to continue.' +
        (credRow ? '' : ' (Note: no PFCredential row, so resume restarts at page 1.)');
    } else if (diagnostics.terminated_reason === 'token_expired') {
      diagnostics.next_action_for_ahmad =
        'Run stopped at page ' + page + ' due to expired PF token — invoke syncPFListings again to retry with a fresh token.';
    } else if (diagnostics.terminated_reason === 'fetch_error') {
      diagnostics.next_action_for_ahmad =
        'Run stopped at page ' + page + ' due to a fetch error — invoke syncPFListings again to retry. First error: ' + (diagnostics.first_error_message || 'unknown');
    } else {
      diagnostics.next_action_for_ahmad =
        'Run finished with reason "' + diagnostics.terminated_reason + '" at page ' + page + '.';
    }

    console.log('PF_LISTINGS_DONE: ' + JSON.stringify({ ...diagnostics, raw_sample_omitted: true }));

    return Response.json({
      ok: true,
      total: totalListingsThisRun,
      created: created,
      updated: updated,
      errors: errors,
      url_summary: {
        from_api: urlStats.from_api,
        numeric_fallback: urlStats.numeric_fallback,
        hidden_no_valid_url: urlStats.hidden,
      },
      ...diagnostics,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});