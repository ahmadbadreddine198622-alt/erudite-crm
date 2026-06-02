import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Idempotent one-pass: set preferred_language on Peninsula 2 landlords
// (project_id) derived from nationality. en is the schema default and is NOT
// written (blanks/unknowns stay en), so only ru/ar/zh/hi are set. Records
// already at the correct value are skipped. Chunked + concurrent under a soft
// deadline. Re-invoke ?confirm=update until done:true. Preview (no params)
// shows the language distribution and how many still need updating.
//
// Mapping (confirmed): ru includes Kazakhstani, Turkmen, Tajik. Adjective forms
// (Russian, Iraqi, Indian, Emirati, ...) are what the nationality field stores.

const PROJECT_ID = '6a1808d8793c2b7606599f55';
const PAGE = 200;
const CONCURRENCY = 15;
const SOFT_DEADLINE_MS = 26000;

const RU = new Set([
  'russian', 'russia', 'russian federation', 'belarusian', 'belarus',
  'kazakhstani', 'kazakhstan', 'kazakh', 'ukrainian', 'ukraine',
  'kyrgyz', 'kyrgyzstan', 'uzbek', 'uzbekistan', 'azerbaijani', 'azerbaijan',
  'armenian', 'armenia', 'turkmen', 'turkmens', 'turkmen(s)', 'turkmenistan',
  'tajik', 'tajikistan',
]);
const ZH = new Set(['chinese', 'china', 'hong kong', 'hongkong', 'taiwanese', 'taiwan']);
const AR = new Set([
  'emirati', 'uae', 'united arab emirates', 'saudi', 'saudi arabian', 'saudi arabia',
  'egyptian', 'egypt', 'jordanian', 'jordan', 'lebanese', 'lebanon', 'syrian', 'syria',
  'iraqi', 'iraq', 'kuwaiti', 'kuwait', 'qatari', 'qatar', 'bahraini', 'bahrain',
  'omani', 'oman', 'moroccan', 'morocco', 'tunisian', 'tunisia', 'algerian', 'algeria',
  'palestinian', 'palestine', 'yemeni', 'yemen', 'sudanese', 'sudan',
]);
const HI = new Set(['indian', 'india']);

function langFor(nat: any): string {
  const n = String(nat || '').trim().toLowerCase();
  if (RU.has(n)) return 'ru';
  if (ZH.has(n)) return 'zh';
  if (AR.has(n)) return 'ar';
  if (HI.has(n)) return 'hi';
  return 'en';
}

async function listAll(entity: any, filter: any) {
  const out: any[] = [];
  for (let page = 0; ; page++) {
    const batch = await entity.filter(filter, '-created_date', PAGE, page * PAGE);
    out.push(...batch);
    if (!batch || batch.length < PAGE) break;
  }
  return out;
}

async function pool(thunks: (() => Promise<void>)[], start: number) {
  for (let i = 0; i < thunks.length; i += CONCURRENCY) {
    if (Date.now() - start > SOFT_DEADLINE_MS) return;
    await Promise.all(thunks.slice(i, i + CONCURRENCY).map((t) => t()));
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user: any = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate below */ }
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const svc = base44.asServiceRole.entities;
  const start = Date.now();

  const landlords = await listAll(svc.Landlord, { project_id: PROJECT_ID });

  const dist: Record<string, number> = { en: 0, ru: 0, ar: 0, zh: 0, hi: 0 };
  const needing: { id: string; lang: string }[] = [];
  for (const L of landlords) {
    const lang = langFor(L.nationality);
    dist[lang]++;
    if (lang !== 'en' && L.preferred_language !== lang) needing.push({ id: L.id, lang });
  }

  const confirm = new URL(req.url).searchParams.get('confirm') === 'update';
  if (!confirm) {
    return Response.json({
      mode: 'preview',
      peninsula2_landlords: landlords.length,
      languageDistribution: dist,
      toUpdate: needing.length,
      note: 'en left to schema default (not written). Re-call ?confirm=update until done:true.',
    });
  }

  const updated: Record<string, number> = { ru: 0, ar: 0, zh: 0, hi: 0 };
  const errors: any[] = [];
  await pool(needing.map((u) => async () => {
    try { await svc.Landlord.update(u.id, { preferred_language: u.lang }); updated[u.lang]++; }
    catch (e) { errors.push({ id: u.id, lang: u.lang, error: String(e) }); }
  }), start);

  const totalUpdated = updated.ru + updated.ar + updated.zh + updated.hi;
  const remaining = needing.length - totalUpdated;

  return Response.json({
    mode: 'update',
    languageDistribution: dist,
    updatedThisRun: updated,
    totalUpdatedThisRun: totalUpdated,
    remaining,
    done: remaining === 0,
    durationMs: Date.now() - start,
    errorCount: errors.length,
    errors: errors.slice(0, 25),
  });
});
