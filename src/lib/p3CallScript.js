// p3CallScript.js — Peninsula 3 deed-based valuation + per-landlord call script engine,
// plus the small shared helpers used across LandlordDetailPage. Extracted from
// LandlordDetailPage to keep that file under the line limit. Pure functions only.

const fmtAED = (n) => {
if (n == null || isNaN(n)) return '—';
if (n >= 1_000_000) return 'AED ' + (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
if (n >= 1_000) return 'AED ' + Math.round(n / 1_000) + 'K';
return 'AED ' + n;
};
const fmtPSF = (n) => {
  if (n == null || isNaN(n)) return '';
  return 'AED ' + Math.round(n).toLocaleString() + '/sqft';
};
/* ---- Peninsula 3 deed-based valuation (from MarketTransaction deed comps) ----
   Lights the Valuation box for P3 landlords even when no LandlordProperty AI valuation
   exists. Parses "P3-1402" / "P3-402" / "P3-P307" / legacy "04-08" unit references.
   Only returns a value when the unit's stack has ≥3 single-type deed comps — never guesses. */
const parseP3UnitRef = (ref) => {
  const raw = String(ref || '').toUpperCase().replace(/\s+/g, '');
  let m = raw.match(/^P3-?([A-Z]?)(\d{2,4})$/);
  if (m) {
    const stack = m[2].slice(-2);
    const floorStr = m[2].slice(0, -2);
    return { floor: (!m[1] && floorStr) ? parseInt(floorStr, 10) : null, stack };
  }
  m = raw.match(/^(\d{1,2})-(\d{2})$/);
  return m ? { floor: parseInt(m[1], 10), stack: m[2] } : null;
};
const P3_TYPE_LABEL = { studio: 'Studio', '1br': '1BR', '2br': '2BR', '3br': '3br', '4plus': '4+BR' };
/* Infer the unit's bedroom type from its stack's deed history (nearest-floors vote — stacks can
   switch layout by floor zone, e.g. -01 is studio low / 2BR high). No floor → only if unanimous. */
const inferP3UnitType = (unit, cleanTxs) => {
  try {
    if (!unit || !Array.isArray(cleanTxs)) return null;
    const stackTx = cleanTxs.filter(t => t.bedrooms && String(t.unit_number || '').endsWith(`-${unit.stack}`));
    if (!stackTx.length) return null;
    if (unit.floor == null) {
      const set = new Set(stackTx.map(t => t.bedrooms));
      return set.size === 1 ? stackTx[0].bedrooms : null;
    }
    const dist = (t) => { const f = parseInt(String(t.unit_number).split('-')[0], 10); return isFinite(f) ? Math.abs(f - unit.floor) : 999; };
    const nearest = stackTx.slice().sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    const votes = {};
    for (const t of nearest) votes[t.bedrooms] = (votes[t.bedrooms] || 0) + 1;
    const win = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return (win.length === 1 || win[0][1] > win[1][1]) ? win[0][0] : nearest[0].bedrooms;
  } catch { return null; }
};
const medianNum = (a) => {
  const x = a.filter(v => typeof v === 'number' && isFinite(v)).sort((p, q) => p - q);
  if (!x.length) return null;
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : Math.round((x[m - 1] + x[m]) / 2);
};
const deriveDeedValuation = (landlord, txs) => {
  try {
    if (!landlord || !Array.isArray(txs) || !txs.length) return null;
    const unit = parseP3UnitRef(landlord.unit_reference);
    if (!unit) return null;
    const clean = txs.filter(t => !t.is_outlier && t.price_per_sqft);
    const unitType = inferP3UnitType(unit, clean);
    if (!unitType) return null; // never value a unit whose type we cannot establish
    const typeLabel = P3_TYPE_LABEL[unitType] || unitType;
    // TYPE-PURE comps: same stack AND same type; thin stack → widen to the whole tower
    // but stay inside the SAME TYPE — a studio is never priced off a 1BR deed.
    let comps = clean.filter(t => t.bedrooms === unitType && String(t.unit_number || '').endsWith(`-${unit.stack}`));
    let scope = `stack -${unit.stack}`;
    if (comps.length < 3) { comps = clean.filter(t => t.bedrooms === unitType); scope = `${typeLabel} deeds tower-wide`; }
    const psf = medianNum(comps.map(t => t.price_per_sqft));
    const sqft = medianNum(comps.map(t => t.area_sqft));
    if (comps.length < 3 || !psf || !sqft) return null;
    const est = Math.round(psf * sqft);
    const conf = (scope.startsWith('stack') && comps.length >= 8) ? 'high' : 'medium';
    const dates = comps.map(t => t.transaction_date).sort();
    const typePsf = medianNum(clean.filter(t => t.bedrooms === unitType).map(t => t.price_per_sqft));
    return {
      estValue: fmtAED(est),
      psf: fmtPSF(psf),
      confLabel: `${conf.charAt(0).toUpperCase() + conf.slice(1)} confidence · deed-based · ${typeLabel}`,
      confStyle: { display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700,
        color: conf === 'high' ? '#34d399' : 'hsl(38 92% 62%)',
        background: conf === 'high' ? 'rgba(16,185,129,0.14)' : 'hsl(38 92% 50% / 0.16)' },
      basis: `${comps.length} × ${typeLabel} DXB Interact deeds (${scope}, ${dates[0]} → ${dates[dates.length - 1]}), median ${Math.round(psf).toLocaleString()}/sqft × ${sqft} sqft. ${typeLabel} tower median ${typePsf}/sqft. Same-type comps only — types are never mixed.`,
      updatedAt: dates[dates.length - 1] ? new Date(dates[dates.length - 1]).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '',
    };
  } catch { return null; }
};
/* ---- Peninsula 3 per-landlord call script engine ----
   Composes a professional, personalized script for every P3 owner from THEIR unit's own
   type benchmarks (DXB Interact deeds — types never mixed) + the live portal ask layer
   (PropertyFinder + Bayut survey, 14 Jul 2026). Deterministic: exact figures only — the
   same discipline as the valuation. Returns null off-P3, verify-first when type unknown. */
const P3_SCRIPT_BENCH = {
  studio: {
    deeds: 27, deedMedianM: 'AED 1.20M', deedPsf: 2801, postFebPsf: 2801, gain: '+26%',
    asks: '36', askMedianM: 'AED 1.27M', askPsf: 3004, gapShort: '+6%', gapLine: 'about 6% above what actually transfers',
    perMo: '2.7', queue: 'a ~13-month queue', rentAvg: '80,928', rentBand: 'AED 75–89K', yieldPct: '6.7%',
    story: "Studios are this tower's liquid trade — 10 of the 27 that transferred have already resold twice, median gain +26%. But the building's only two losses were also studios that overpaid at the February peak: entry and exit price is everything on this type.",
    anchor: "Studio asks are already being corrected in public — there are −6% and −11% price-drop tags live on PropertyFinder today. The deed line — 2,801 a foot — is where studios actually change hands.",
  },
  '1br': {
    deeds: 62, deedMedianM: 'AED 1.79M', deedPsf: 2598, postFebPsf: 2584, gain: '+25%',
    asks: '140', askMedianM: 'AED 1.87M', askPsf: 2730, gapShort: '+4–6%', gapLine: '4–6% above what actually transfers',
    perMo: '6', queue: 'a ~22-month queue', rentAvg: '116,935', rentBand: 'AED 85–145K', yieldPct: '6.5%',
    story: "One-beds are the tower's deepest market — 59% of every deed, 60 disclosed resales, zero losses, median gain +25%. The catch: 140 of them are asking on the portals right now, so pricing decides everything.",
    anchor: "One-beds cooled the most off the February peak — 2,800 down to 2,584 a foot on registered deeds. Even PropertyFinder's own trailing 1BR average (1.759M at 2,599) sides with the deeds, not the asks. We price off the last 90 days.",
  },
  '2br': {
    deeds: 16, deedMedianM: 'AED 2.78M', deedPsf: 2806, postFebPsf: 2776, gain: '+24%',
    asks: '~50', askMedianM: 'AED 2.85M', askPsf: 2910, gapShort: '+2–5%', gapLine: 'only 2–5% above deed level — the tightest gap in the tower',
    perMo: '1.6', queue: 'a scarcity queue', rentAvg: '187,899', rentBand: 'AED 155–210K', yieldPct: '6.8%',
    story: "Two-beds are the scarcity play — only 16 deeds in six months, 11 of them on floors 31–49, and June printed the building records: unit 34-11 at AED 3.40M, 3,445 a foot, +52%. The only type setting highs right now.",
    anchor: "I won't argue the premium — 2BR is the only type printing record deeds. But the records are specific: high floor, canal side. The type's deed median is 2,806 a foot — that's the honest base, and the floor/view premium is argued on top of it with evidence.",
  },
};
const P3_1BR_BAND = (floor) => floor == null ? null : floor <= 15 ? { band: '4–15', psf: 2507 } : floor <= 30 ? { band: '16–30', psf: 2582 } : { band: '31–49', psf: 2772 };
const buildP3CallScript = ({ L, prop, lp, p3Unit, p3UnitType, compsPool, valuation }) => {
  try {
    const projName = String(L?.project_name || prop?.building_name || '').trim();
    if (!(/peninsula\s*(3|three)\b/i.test(projName) || /^p3$/i.test(projName))) return null;
    const first = (String(L?.full_name || '').trim().split(/\s+/)[0]) || 'there';
    const fullName = String(L?.full_name || 'Owner').trim();
    const unitRef = prop?.unit_no || L?.unit_reference || 'your unit';
    const typeLabel = p3UnitType ? (P3_TYPE_LABEL[p3UnitType] || p3UnitType) : null;
    const bench = p3UnitType ? P3_SCRIPT_BENCH[p3UnitType] : null;
    const floor = p3Unit?.floor ?? null;

    // Unknown type (or 3BR+/penthouse with no per-type bench): verification-first script —
    // TYPE DISCIPLINE means no figures leave the card until the layout is confirmed.
    if (!bench) {
      const rare = !!typeLabel; // known but rare type (3BR+): scarcity wording instead of unknown
      return {
        header: `Landlord Script — ${fullName} · ${unitRef}`,
        chip: rare ? `${typeLabel} · manual valuation` : 'Verify type first',
        meta: `Personalized for ${fullName} · ${unitRef}${floor != null ? ` · floor ${floor}` : ''} — ${rare ? 'rare type: too few deeds for a median; value it manually against record prints.' : 'figures stay locked until the layout is confirmed on the title deed.'}`,
        evalStrip: [
          { k: 'Unit type', v: rare ? typeLabel : 'Unverified', sub: rare ? 'thin deed sample' : 'figures locked' },
          { k: 'Building median', v: '2,691/sqft', sub: 'context only — never quoted' },
        ],
        sections: [
          { title: 'Open', lines: [`Hello ${first}, this is [your name] from ERUDITE, about ${unitRef} in Peninsula 3. Before I quote you a single number, I need thirty seconds of your help — in this tower the figures change completely by layout.`] },
          rare
            ? { title: 'Position it honestly', lines: [`A ${typeLabel} in Peninsula 3 trades on pure scarcity — too few registered deeds for an honest median, and I won't invent one. What I'll do instead: value it manually against the building's record prints and the neighbouring towers, and walk you through every comparable I used.`] }
            : { title: 'Verify the layout', lines: [`Is ${unitRef} registered as a studio, a one-bedroom or a two-bedroom on the title deed? The same stack can switch layout by floor here, so we never guess.`, `The moment you confirm it, I'll send your layout's own deed sheet — registered DXB transfers only, not listings — and your unit's deed-based value within the hour.`] },
          { title: 'Close', lines: [rare ? `Give me twenty minutes this week, ${first} — I'll bring the manual valuation signed off and the exact plan for a unit this rare.` : `So — what does the title deed say, ${first}: studio, one or two bedrooms? I'll take it from there.`] },
        ],
        footer: 'Type discipline: studio is studio, 1BR is 1BR, 2BR is 2BR — no figure is quoted across types, ever.',
      };
    }

    // ── live math from THIS unit's own type comps (never mixed) ──
    const pool = (compsPool || []).filter(t => t && t.bedrooms === p3UnitType && !t.is_outlier);
    const sorted = pool.slice().sort((a, b) => String(b.transaction_date || '').localeCompare(String(a.transaction_date || '')));
    const latestDeed = sorted.find(t => t.price_aed && t.price_per_sqft) || null;
    const medPsf = medianNum(pool.map(t => t.price_per_sqft));
    const medSqft = medianNum(pool.map(t => t.area_sqft));
    const estNum = (lp && lp.ai_estimated_value_aed) ? Math.round(lp.ai_estimated_value_aed) : ((pool.length >= 3 && medPsf && medSqft) ? Math.round(medPsf * medSqft) : null);
    const estLabel = valuation?.estValue || (estNum ? fmtAED(estNum) : null);
    const stackCount = p3Unit ? pool.filter(t => String(t.unit_number || '').endsWith(`-${p3Unit.stack}`)).length : 0;
    const band = p3UnitType === '1br' ? P3_1BR_BAND(floor) : null;
    const askingNum = Number(L?.asking_price_aed || prop?.price_aed) || null;
    const askGapPct = (askingNum && estNum) ? Math.round(((askingNum - estNum) / estNum) * 100) : null;
    const latestLine = latestDeed
      ? `The last ${typeLabel} to transfer here was unit ${latestDeed.unit_number} on ${new Date(latestDeed.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${fmtAED(latestDeed.price_aed)} at ${Number(latestDeed.price_per_sqft).toLocaleString()}/sqft. Registered transfer, not an asking price.`
      : `On DXB Interact, ${bench.deeds} ${typeLabel} deeds registered this cycle — median ${bench.deedMedianM} at ${bench.deedPsf.toLocaleString()}/sqft. Registered transfers, not asking prices.`;

    const stage = String(L?.stage || '');
    const preLive = ['listing_commitment', 'form_a_initiation', 'form_a_signing', 'owner_documents', 'photos_videos', 'photographer_scheduling', 'listing_creation', 'internal_verification'].includes(stage);
    const live = ['listing_publication', 'final_confirmation', 'marketing_agents', 'marketing_network', 'open_house', 'client_blast'].includes(stage);
    const opener = preLive
      ? `${first}, before we go live: here is exactly where ${unitRef} prices against the registered deeds — we are listing to sell, not to sit.`
      : live
        ? `${first}, market update on ${unitRef}: this is the deed math I use with every buyer who calls — and where your competition moved this week.`
        : `Hello ${first}, this is [your name] from ERUDITE. I'll take ninety seconds, not more. I've just closed the July deed file for Peninsula 3 — every ${typeLabel} transfer registered this year${stackCount ? `, including ${stackCount} in your own -${p3Unit.stack} stack` : ''} — and ${unitRef} sits in a strong position. May I share the two numbers that matter?`;

    const numbersLines = [
      latestLine,
      `Across ${bench.deeds} registered ${typeLabel} deeds this year the median is ${bench.deedMedianM} at ${bench.deedPsf.toLocaleString()}/sqft${bench.postFebPsf !== bench.deedPsf ? ` — and the post-February market clears at ${bench.postFebPsf.toLocaleString()}` : ''}. Median owner gain on resale: ${bench.gain}.`,
    ];
    if (estLabel) numbersLines.push(`For ${unitRef}${floor != null ? ` on floor ${floor}` : ''}${band ? ` (floors ${band.band} clear at ${band.psf.toLocaleString()}/sqft)` : ''}, that puts deed value at ~${estLabel}.`);
    numbersLines.push(bench.story);

    const competitionLines = [
      `Right now ${bench.asks} ${typeLabel}s are asking on PropertyFinder at a median of ${bench.askMedianM} — ${bench.gapLine}. Roughly ${bench.perMo} ${typeLabel} deeds actually close per month.`,
      `Priced at the deed line, ${unitRef} is one of the three cheapest ${typeLabel}s in the building and meets every serious buyer this month. Priced with the crowd, it joins ${bench.queue}.`,
    ];

    const doorsLines = [
      `Door one — sell: at the deed line${estLabel ? ` (~${estLabel})` : ''}, with the transfer receipts to defend every dirham of it.`,
      `Door two — hold: ${typeLabel}s rent at ${bench.rentBand} (average AED ${bench.rentAvg}) — about ${bench.yieldPct} gross on deed value. 270 rentals are competing at handover, so we price the rent to let in two weeks, not two months.`,
      `Both are good doors, ${first}. My job is the honest math on each — you choose the door.`,
    ];

    const anchorLines = [bench.anchor];
    if (askGapPct != null && askGapPct >= 4) anchorLines.push(`On your ${fmtAED(askingNum)} figure: it sits about ${askGapPct}% above the deed line — on today's board that is ${bench.queue}. Two honest moves: meet the market at ~${estLabel}, or hold, rent at ${bench.rentBand}, and let the next deed print catch up to you.`);
    else if (askGapPct != null && askGapPct <= -4) anchorLines.push(`Your ${fmtAED(askingNum)} figure is actually below the deed line — we are leaving money on the table. I'd position at ~${estLabel} and still be the sharpest ${typeLabel} on the board.`);
    else if (askGapPct != null) anchorLines.push(`Your ${fmtAED(askingNum)} figure is already inside the deed band — well positioned. I'll defend it with registered transfers, not adjectives.`);
    anchorLines.push(`If a neighbour's listing comes up: an ask is an advertisement — ~150 owners are asking across the tower and ~11 deeds a month actually transfer. The DLD deed is the price.`);

    const closeLines = [
      `${first}, I'll send you the ${typeLabel} deed sheet on WhatsApp — registered transfers, not listings. Look at it tonight and tell me which number feels wrong.`,
      `Then give me twenty minutes this week — I'll bring the valuation signed off and the exact go-to-market plan for ${unitRef}. If we agree on the number, Form A takes ten minutes and we are the first call every serious buyer makes.`,
    ];

    return {
      header: `Landlord Script — ${fullName} · ${unitRef}`,
      chip: typeLabel,
      meta: `Personalized for ${fullName} · ${unitRef}${floor != null ? ` · floor ${floor}` : ''}${p3Unit ? ` · stack -${p3Unit.stack}` : ''} — built from ${bench.deeds} ${typeLabel} deeds + the live portal survey (14 Jul 2026). ${typeLabel} figures only.`,
      evalStrip: [
        { k: 'Deed value', v: estLabel || '—', sub: `${typeLabel} · deed-based` },
        { k: `${typeLabel} deed median`, v: `${bench.deedPsf.toLocaleString()}/sqft`, sub: `${bench.deeds} deeds · ${bench.deedMedianM}` },
        { k: 'Portal ask median', v: bench.askMedianM, sub: `${bench.asks} live asks · ${bench.askPsf.toLocaleString()}/sqft` },
        { k: 'Ask vs deed', v: bench.gapShort, sub: 'asks over the deed line' },
        { k: 'Rent · gross', v: `AED ${bench.rentAvg}/yr`, sub: `${bench.rentBand} · ${bench.yieldPct} gross` },
        ...(askingNum ? [{ k: 'Owner ask', v: fmtAED(askingNum), sub: askGapPct != null ? `${askGapPct >= 0 ? '+' : ''}${askGapPct}% vs deed value` : 'on file' }] : []),
      ],
      sections: [
        { title: 'Open', lines: [opener] },
        { title: 'The numbers — their type only', lines: numbersLines },
        { title: 'The competition — portal truth', lines: competitionLines },
        { title: 'Two doors', lines: doorsLines },
        { title: 'If they anchor high', accent: '#fca5a5', lines: anchorLines },
        { title: 'Close', accent: '#34d399', lines: closeLines },
      ],
      footer: `Deterministic script — every figure is a registered DXB Interact deed or the 14 Jul 2026 portal survey. Types are never mixed: this script quotes ${typeLabel} figures only.`,
    };
  } catch { return null; }
};
const fmtStamp = (ts) => {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return String(ts);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};
const tsOf = (x) => { const d = new Date(x); return isNaN(d) ? 0 : d.getTime(); };
/* Run a queryFn that may reference an entity that doesn't exist yet — never throw. */
const safe = async (fn) => { try { return (await fn()) || []; } catch { return []; } };
const latest = (arr, dateKey) => {
  if (!arr || !arr.length) return null;
  return [...arr].sort((a, b) => tsOf(b[dateKey] || b.created_date) - tsOf(a[dateKey] || a.created_date))[0];
};

// Full stage enum from Landlord entity schema (17 values)
const PIPELINE_STAGES = [
  'initial_contact','attempted_to_contact','price_discovery','listing_commitment','form_a_initiation','form_a_signing',
  'owner_documents','photos_videos','photographer_scheduling','listing_creation','internal_verification',
  'listing_publication','final_confirmation','marketing_agents','marketing_network','open_house',
  'client_blast','deal_closed',
];

function temperatureFromRapport(rapport) {
  if (rapport === 'champion' || rapport === 'trust_established') return 'hot';
  if (rapport === 'warming' || rapport === 'rapport_built') return 'warm';
  return 'cold';
}

export {
  fmtAED, fmtPSF, parseP3UnitRef, P3_TYPE_LABEL, inferP3UnitType, medianNum,
  deriveDeedValuation, buildP3CallScript, fmtStamp, tsOf, safe, latest,
  PIPELINE_STAGES, temperatureFromRapport,
};