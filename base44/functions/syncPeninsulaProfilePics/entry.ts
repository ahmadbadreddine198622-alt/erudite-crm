import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * syncPeninsulaProfilePics — fetch WhatsApp profile pictures for Peninsula
 * 2/3/4 landlords and persist them on the Landlord record (wa_profile_pic_url)
 * so the vCard PHOTO embed and identity avatar work for every owner.
 *
 * Two modes:
 *   1. CHUNKED (preferred): pass { entries: [{ phone, ids: [landlordId,...] }, ...] }.
 *      Skips the full landlord reload — just fetches pics for the given phones
 *      and updates the listed landlord records. Safe to run in parallel with
 *      disjoint phone sets.
 *   2. AUTO: no entries → loads all landlords, filters Peninsula 2/3/4, builds
 *      the phone→ids map, and processes the first `batchSize` still-unfetched
 *      phones (skip=0 always in auto mode; fetched phones drop out of the set).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const concurrency = Math.min(parseInt(payload.concurrency ?? '6', 10) || 6, 10);

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!evolutionApiUrl || !evolutionApiKey) {
      return Response.json({ error: 'Missing Evolution API secrets' }, { status: 500 });
    }
    const defaultInstances = ['Samy', 'Abduhafiz', 'erudite_main ', 'Adeyemi Opeyemi', 'Erudite real estate ', 'erudite_whatsapp'];
    const instances = (Array.isArray(payload.instances) && payload.instances.length ? payload.instances : defaultInstances)
      .map((s) => String(s).trim()).filter(Boolean);

    // Build the work list (phone -> [landlordIds]).
    let work = []; // [{ phone, ids }]
    if (Array.isArray(payload.entries) && payload.entries.length) {
      work = payload.entries
        .filter((e) => e && e.phone && Array.isArray(e.ids))
        .map((e) => ({ phone: e.phone, ids: e.ids }));
    } else {
      // AUTO mode: load all landlords, filter Peninsula 2/3/4.
      const batchSize = Math.min(parseInt(payload.batchSize ?? '250', 10) || 250, 400);
      const all = [];
      const limit = 1000, MAX_PAGES = 40, PARALLEL = 5;
      const fetchPage = async (s) => {
        const res = await base44.asServiceRole.functions.invoke('loadAllLandlords', { skip: s, limit });
        const data = res?.data ?? res;
        return { page: data?.landlords || [], hasMore: !!data?.hasMore };
      };
      let r0 = await fetchPage(0);
      all.push(...r0.page);
      let fetched = 1;
      while (r0.hasMore && fetched < MAX_PAGES) {
        const round = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => fetchPage((fetched + i) * limit)));
        round.forEach((r) => all.push(...r.page));
        r0.hasMore = round[round.length - 1].hasMore;
        fetched += PARALLEL;
      }
      const isPen = (l) => /peninsula\s*[234]/i.test(l.project_name || '') || /peninsula\s*[234]/i.test(l.unit_reference || '');
      const phoneToIds = {};
      const ordered = [];
      const seen = new Set();
      for (const l of all.filter(isPen)) {
        for (const n of [l.phone, l.whatsapp, ...((l.additional_phones || []).filter(Boolean))]) {
          if (!n) continue;
          const clean = '+' + n.replace(/[^\d]/g, '');
          if (!seen.has(clean)) { seen.add(clean); ordered.push(clean); }
          if (!phoneToIds[clean]) phoneToIds[clean] = [];
          if (!l.wa_profile_pic_fetched_at) phoneToIds[clean].push(l.id);
        }
      }
      work = ordered.filter((p) => phoneToIds[p].length > 0).slice(0, batchSize).map((p) => ({ phone: p, ids: phoneToIds[p] }));
    }

    if (work.length === 0) {
      return Response.json({ status: 'done', summary: { processed: 0, with_pic: 0, no_photo: 0, failed: 0, complete: true } });
    }

    // Fetch profile pics. Try each open instance until one resolves.
    const fetchPicOnce = async (phone, inst) => {
      try {
        const res = await fetch(`${evolutionApiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(inst)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
          body: JSON.stringify({ number: phone.replace('+', '') }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, status: res.status, pic: null };
        return { ok: true, pic: data.profilePictureUrl || 'no_photo' };
      } catch { return { ok: false, status: 0, pic: null }; }
    };
    const fetchPic = async (phone) => {
      for (const inst of instances) {
        const r = await fetchPicOnce(phone, inst);
        if (r.ok) return { phone, pic: r.pic, error: null, instance: inst };
      }
      return { phone, pic: null, error: 'all_instances_failed' };
    };

    const results = [];
    for (let i = 0; i < work.length; i += concurrency) {
      const chunk = work.slice(i, i + concurrency);
      results.push(...await Promise.all(chunk.map((w) => fetchPic(w.phone))));
      if (i + concurrency < work.length) await new Promise((r) => setTimeout(r, 80));
    }

    // Bulk-update Landlord records.
    const now = new Date().toISOString();
    const idToVal = {};
    for (const r of results) {
      if (r.error) continue;
      const val = r.pic && r.pic !== 'no_photo' ? r.pic : 'no_photo';
      const entry = work.find((w) => w.phone === r.phone);
      for (const id of entry?.ids || []) idToVal[id] = val;
    }
    const updateIds = Object.keys(idToVal);
    let updated = 0;
    for (const id of updateIds) {
      try {
        await base44.asServiceRole.entities.Landlord.update(id, {
          wa_profile_pic_url: idToVal[id],
          wa_profile_pic_fetched_at: now,
        });
        updated++;
      } catch { /* ignore single update failure */ }
    }

    const withPic = results.filter((r) => r.pic && r.pic !== 'no_photo').length;
    const noPhoto = results.filter((r) => r.pic === 'no_photo').length;
    const failed = results.filter((r) => r.error).length;

    return Response.json({
      status: 'success',
      summary: {
        processed: results.length,
        with_pic: withPic,
        no_photo: noPhoto,
        failed,
        updated,
        complete: !Array.isArray(payload.entries), // auto mode: true when nothing left
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});