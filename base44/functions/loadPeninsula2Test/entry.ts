import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * TEST LOAD — Peninsula 2 landlord backfill (first 10 rows with a phone).
 *
 * Trial run of the Peninsula 2 backfill: loads 10 mapped Landlord records so
 * the result can be inspected in Base44 before the full 593-row load.
 *
 * Source: Peninsula-2.xlsx — the FIRST 10 top-down rows where Mobile1 is
 * non-empty (source rows 3,4,7,8,13,14,15,16,17,18). Mapping, phone
 * normalization (E.164), name/unit cleanup and the field set were all done
 * up front; the records below are the exact mapped output.
 *
 * Only the fields in the agreed mapping are set — finance, mandate and AI
 * fields are intentionally left at their entity defaults.
 *
 * Idempotent: skips a record if a Landlord with the same
 * phone + unit_reference + email + project_id already exists (so the two
 * Anastasiia rows that share phone+unit but differ by email stay distinct,
 * and the two Gulnara rows that share phone but differ by unit stay distinct).
 * Pass { force: true } to create regardless of existing matches.
 *
 * Invoke from the Base44 Functions UI, OR from the browser console:
 *   await base44.functions.loadPeninsula2Test()
 *   await base44.functions.loadPeninsula2Test({ force: true })
 *
 * NOTE on flagged phones (kept as-is per instruction — this is a test):
 *   - ASTER ABRAHA  phone +971924312169  — national part starts with 9, not a
 *     UAE mobile (5x) prefix. Loaded as-is.
 *   - AMMAR ZEIN    additional +971500000123 — looks like a placeholder.
 *     Loaded as-is.
 */

// Exact mapped records (stage_entered_at is stamped once at invocation below).
const RECORDS: any[] = [
  {
    full_name_en: 'BASHEER MOHAMMAD SHAIK MASTHAN SAHEB',
    first_name: 'BASHEER',
    last_name: 'MOHAMMAD SHAIK MASTHAN SAHEB',
    phone: '+971525387464',
    additional_phones: [],
    email: 'basheer.mohammad@gmail.com',
    nationality: 'India',
    residence_country: 'India',
    unit_reference: '202',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    full_name_en: 'IRINA KULIKOVA',
    first_name: 'IRINA',
    last_name: 'KULIKOVA',
    phone: '+971509870177',
    additional_phones: [],
    email: '2949999@gmail.com',
    nationality: 'Russian Federation',
    residence_country: 'Russian Federation',
    unit_reference: '202',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    // FLAGGED phone (+971924312169 — not a 5x UAE mobile prefix). Kept as-is.
    full_name_en: 'ASTER ABRAHA',
    first_name: 'ASTER',
    last_name: 'ABRAHA',
    phone: '+971924312169',
    additional_phones: [],
    email: 'emaylu@yahoo.com',
    nationality: 'United States of America',
    residence_country: 'United States of America',
    unit_reference: '205',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    full_name_en: 'GULNARA KHALILOVA',
    first_name: 'GULNARA',
    last_name: 'KHALILOVA',
    phone: '+971545056886',
    additional_phones: [],
    email: 'abid.mamedov@gmail.com',
    nationality: 'Azerbaijan',
    residence_country: 'Azerbaijan',
    unit_reference: '301',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    full_name_en: 'RUSLAN MAMEDOV',
    first_name: 'RUSLAN',
    last_name: 'MAMEDOV',
    phone: '+971543227727',
    additional_phones: [],
    email: 'abid.mamedov@gmail.com',
    nationality: 'Azerbaijan',
    residence_country: 'Azerbaijan',
    unit_reference: '305',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    // FLAGGED additional phone (+971500000123 — placeholder-looking). Kept as-is.
    full_name_en: 'AMMAR ZEIN',
    first_name: 'AMMAR',
    last_name: 'ZEIN',
    phone: '+971501918956',
    additional_phones: ['+971500000123'],
    email: 'ammarzeinbros@gmail.com',
    nationality: 'Hungary',
    residence_country: 'Hungary',
    unit_reference: '306',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    full_name_en: 'ROMAN PETRENKO',
    first_name: 'ROMAN',
    last_name: 'PETRENKO',
    phone: '+971501040288',
    additional_phones: ['+971566529988', '+971508486398'],
    email: 'develop@goldinvest.capital',
    nationality: 'Ukraine',
    residence_country: 'Ukraine',
    unit_reference: '307',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    full_name_en: 'ANASTASIIA AVERINA',
    first_name: 'ANASTASIIA',
    last_name: 'AVERINA',
    phone: '+971525958462',
    additional_phones: [],
    email: 'kozachuk@primerway.ru',
    nationality: 'Russian Federation',
    residence_country: 'Russian Federation',
    unit_reference: '308',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    full_name_en: 'ANASTASIIA AVERINA',
    first_name: 'ANASTASIIA',
    last_name: 'AVERINA',
    phone: '+971525958462',
    additional_phones: [],
    email: 'nishadk@altareshgov.com',
    nationality: 'Russian Federation',
    residence_country: 'Russian Federation',
    unit_reference: '308',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
  {
    full_name_en: 'GULNARA KHALILOVA',
    first_name: 'GULNARA',
    last_name: 'KHALILOVA',
    phone: '+971545056886',
    additional_phones: [],
    email: 'abid.mamedov@gmail.com',
    nationality: 'Azerbaijan',
    residence_country: 'Azerbaijan',
    unit_reference: '309',
    project_name: 'Peninsula 2',
    project_id: '6a1808d8793c2b7606599f55',
    source: 'dld_lookup',
    stage: 'initial_contact',
    assigned_agent_email: 'ahmad@erudite-estate.com',
    lead_type: 'landlord_sale',
  },
];

const sig = (r: any) =>
  `${r.phone}|${r.unit_reference}|${(r.email || '').toLowerCase()}|${r.project_id}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const force = (await req.json().catch(() => ({}))).force === true;

    // Single shared load timestamp for stage_entered_at across all 10 records.
    const loadedAt = new Date().toISOString();

    // Build the set of already-loaded signatures for this project (idempotency).
    const existingSigs = new Set<string>();
    if (!force) {
      const existing = await base44.asServiceRole.entities.Landlord.filter({
        project_id: '6a1808d8793c2b7606599f55',
      });
      for (const l of existing || []) existingSigs.add(sig(l));
    }

    const created: any[] = [];
    const skipped: any[] = [];

    for (const rec of RECORDS) {
      if (!force && existingSigs.has(sig(rec))) {
        skipped.push({ name: rec.full_name_en, phone: rec.phone, unit: rec.unit_reference });
        continue;
      }
      const landlord = await base44.asServiceRole.entities.Landlord.create({
        ...rec,
        stage_entered_at: loadedAt,
      });
      existingSigs.add(sig(rec)); // guard against in-batch exact dupes
      created.push({
        id: landlord.id,
        name: landlord.full_name_en,
        phone: landlord.phone,
        unit_reference: landlord.unit_reference,
        email: landlord.email,
      });
    }

    return Response.json({
      ok: true,
      loaded_at: loadedAt,
      assigned_agent_email: 'ahmad@erudite-estate.com',
      created: created.length,
      skipped: skipped.length,
      record_ids: created.map((c) => c.id),
      landlords: created,
      skipped_records: skipped,
      flagged_phones: [
        { name: 'ASTER ABRAHA', phone: '+971924312169', reason: 'national part starts with 9, not a UAE mobile (5x) prefix — loaded as-is' },
        { name: 'AMMAR ZEIN', additional_phone: '+971500000123', reason: 'placeholder-looking number — loaded as-is' },
      ],
      message: `Created ${created.length} test landlords${skipped.length ? `, skipped ${skipped.length} already present` : ''}. Open /landlords to inspect.`,
    });
  } catch (error: any) {
    console.error('loadPeninsula2Test error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});
