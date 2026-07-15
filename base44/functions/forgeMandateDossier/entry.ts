import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// forgeMandateDossier — THE MANDATE DOSSIER FORGE.
//
// Fired from the gold "Forge Dossier" button on the landlord card. Studies everything the
// system knows about this owner — the brain report (deal thesis, rolling summary, objections),
// the unit (LandlordProperty + AI valuation), the market (DXB Interact MarketReport +
// MarketTransaction comps for the building), the call-script value hooks (verified figures),
// active Founder Directives and the active BrandVoice charter — then forges the NARRATIVE for
// an owner-facing "why list with Erudite" proposal document in the owner's language (en | ru).
//
// FABRICATION FIREWALL FOR DOCUMENTS: the model writes PROSE ONLY. Every number printed in
// the PDF (valuation, comps, medians, pricing scenarios) comes from data_snapshot — computed
// deterministically HERE from live records — never from model output. A dossier with an
// invented figure in an owner's hands is a catastrophe; this architecture makes it impossible.
//
// The branded PDF itself is rendered client-side (src/lib/buildMandateDossierPDF.js) from
// narrative + data_snapshot, using the shared pdfBrand identity (navy/gold, logo, signature,
// stamp, TRN). This function persists a MandateDossier record (status 'forged') and returns
// everything the client needs to build, upload and download the PDF.
//
// KEEP IN SYNC: buildWriter / buildCredibilityBlock mirror forgeApproachDrafts (writer-identity
// doctrine sync group). If the credibility facts change there, change them here.

const MODEL = 'claude-opus-4-8';

// ── WRITER IDENTITY ── the dossier is signed by the LOGGED-IN USER, in their real position.
const CEO_EMAILS = ['ahmad.badreddine198622@gmail.com', 'ahmad@erudite-estate.com'];

function buildWriter(u) {
  const email = String(u?.email || '').trim().toLowerCase();
  const isCEO = CEO_EMAILS.includes(email);
  const rawName = String(u?.display_name || u?.full_name || '').trim();
  const name = isCEO ? 'Ahmad Badreddine' : (rawName || 'Your Erudite Consultant');
  const firstName = name.split(/\s+/)[0];
  const position = isCEO ? 'CEO of Erudite Real Estate' : (String(u?.position || '').trim() || 'Property Consultant');
  return { email, isCEO, name, firstName, position, brn: String(u?.brn || '').trim() };
}

function buildCredibilityBlock(w) {
  if (w.isCEO) {
    return `ERUDITE CREDIBILITY — the ONLY credibility facts you may use, each expressed as an owner-benefit, never a boast:
- Ahmad Badreddine: SuperAgent on Property Finder, 4.3★ rating, 12+ years in Dubai real estate (since 2014), Dubai BRN 34625, CEO of Erudite Real Estate — a senior, accountable principal handling the owner's unit personally.
- Erudite is a 25-agent brokerage — "25 active buyer-handlers working your unit from day one", never just "we are a big team".
- Business Bay / Peninsula specialists with a real track record. If a real comp appears in the verified data below, reference THAT comp; if none is supplied, speak to specialization generally — do NOT invent a comp, figure, or transaction.
- Ahmad personally speaks English, Arabic, French, Russian and Mandarin — direct-in-their-language is a trust point when relevant.
- Erudite responds within 5 minutes — reliability FOR THE OWNER, not a slogan.
- VERIFIED PUBLIC FIGURES: 56 closed deals, AED 87.9M total deals value, 56 sale + 17 rent listings live. Always as owner-benefit.
HARD GUARDRAIL: NEVER use larger or rounder figures than these. NEVER fabricate or inflate any number, price, date, comp, buyer, or transaction. If a fact is not in this block or in the verified data below, it does not exist. A generic dossier is a failure; an invented fact is a catastrophe.`;
  }
  const brnLine = w.brn ? `- Your own RERA BRN ${w.brn} — citable as your personal accountability anchor.\n` : '';
  return `WRITER IDENTITY — you are ${w.name}, ${w.position} at Erudite Real Estate, Dubai (Business Bay). Write in first person as ${w.firstName}: senior, courteous, professional. YOU ARE NOT THE CEO — never present yourself as Ahmad Badreddine, never claim his personal credentials as your own.

ERUDITE CREDIBILITY — the ONLY credibility facts you may use. YOUR facts stay first person; COMPANY facts are "we / our brokerage"; the CEO's facts stay strictly THIRD person:
${brnLine}- Erudite Real Estate is a 25-agent Dubai brokerage led by CEO Ahmad Badreddine — SuperAgent on Property Finder, 4.3★, 12+ years in Dubai real estate, BRN 34625. Frame as: the owner's unit is backed by a senior accountable principal AND a full buyer-handling team behind you.
- "25 active buyer-handlers working your unit from day one" — always "our team", never your personal team.
- Business Bay / Peninsula specialists with a real track record. If a real comp appears in the verified data below, reference THAT comp; if none is supplied, speak to specialization generally — do NOT invent one.
- Erudite responds within 5 minutes — a company standard ("we").
- VERIFIED PUBLIC FIGURES (company-level framing ONLY): 56 closed deals, AED 87.9M total deals value, 56 sale + 17 rent listings live — always "a brokerage that has closed…", NEVER "I have closed…".
- Our team serves clients in English, Arabic, French, Russian and Mandarin — company-level only.
HARD GUARDRAIL: NEVER use larger or rounder figures than these. NEVER fabricate or inflate any number, price, date, comp, buyer, or transaction. If a fact is not in this block or in the verified data below, it does not exist. A generic dossier is a failure; an invented fact is a catastrophe.`;
}

// ── The forced output schema — PROSE ONLY. Numbers live in data_snapshot. ──
const DOSSIER_SCHEMA = {
  type: 'object',
  properties: {
    cover_tagline: { type: 'string', description: 'One elegant line for the cover, max 14 words, in the dossier language. No numbers.' },
    opening_letter: { type: 'string', description: "Personal letter from the writer to the owner. 120-180 words. Starts with a salutation using the owner's name. References their ACTUAL situation from the intelligence. Warm, senior, zero pressure. No sign-off block (the layout adds it)." },
    property_position: { type: 'string', description: "80-130 words interpreting the unit's position today — layout, building, tenancy reality. Interpret ONLY supplied facts; if the valuation block is absent, state plainly that a formal written valuation is prepared within 48 hours of engagement. NEVER write a number in this text — the layout prints the verified figures beside it." },
    market_read: { type: 'string', description: '90-140 words reading the market supplied. The layout prints the medians and the comps table — do not restate those. You MAY quote specific verified figures from the VERIFIED MARKET INTELLIGENCE block exactly as written (gain stories, record prints, yield) — this is the persuasive core. If no market block is supplied, write an honest paragraph on how Erudite builds the pricing picture from DLD transaction data. No invented numbers.' },
    pricing_narrative: { type: 'string', description: '60-100 words explaining the three-scenario pricing strategy philosophy (premium positioning vs market pace vs velocity) and how the recommended anchor was derived from verified data. No numbers in the text.' },
    scenario_premium: { type: 'string', description: 'Descriptor for the Premium scenario, max 18 words, no numbers.' },
    scenario_market: { type: 'string', description: 'Descriptor for the Market scenario, max 18 words, no numbers.' },
    scenario_fast: { type: 'string', description: 'Descriptor for the Velocity scenario, max 18 words, no numbers.' },
    why_erudite: {
      type: 'array', minItems: 5, maxItems: 5,
      description: 'Exactly 5 owner-benefit blocks built ONLY from the credibility facts.',
      items: { type: 'object', properties: { title: { type: 'string', description: 'Max 5 words.' }, body: { type: 'string', description: 'Max 30 words, owner-benefit framing.' } }, required: ['title', 'body'] },
    },
    process_steps: {
      type: 'array', minItems: 6, maxItems: 7,
      description: 'The step-by-step process, localized from the PROCESS OUTLINE supplied — never invent steps.',
      items: { type: 'object', properties: { title: { type: 'string', description: 'Max 6 words.' }, body: { type: 'string', description: 'Max 22 words.' }, timeframe: { type: 'string', description: 'Short timeframe label from the outline, e.g. "Day 1" / "Week 1".' } }, required: ['title', 'body', 'timeframe'] },
    },
    exclusive_case: { type: 'string', description: '80-120 words making the case for an exclusive mandate — additive, confident, never attacking other brokers. If known objections are supplied, quietly pre-empt them without naming them as objections.' },
    closing_line: { type: 'string', description: '1-2 sentences. The dignified close: the single concrete next step.' },
    send_cover_message: { type: 'string', description: "The chat message that accompanies the dossier when it is sent (WhatsApp/iMessage/Telegram/Email). 40-70 words in the dossier language: tell the owner a private dossier prepared for their specific unit is attached, one line on what is inside (their valuation and the building's verified market record), one easy ask. No links, no emojis, no signature block." },
    language: { type: 'string', description: 'Language code actually used ("en" or "ru").' },
  },
  required: ['cover_tagline', 'opening_letter', 'property_position', 'market_read', 'pricing_narrative', 'scenario_premium', 'scenario_market', 'scenario_fast', 'why_erudite', 'process_steps', 'exclusive_case', 'closing_line', 'send_cover_message', 'language'],
};

const clean = (v) => (v == null ? '' : String(v).trim());
const round1k = (n) => Math.round(n / 1000) * 1000;

// unit_layout shorthand → MarketTransaction bedrooms bucket
function bedsBucket(layout) {
  const s = String(layout || '').toLowerCase();
  if (/studio/.test(s)) return 'studio';
  if (/^1|1\s*b/.test(s)) return '1br';
  if (/^2|2\s*b/.test(s)) return '2br';
  if (/^3|3\s*b/.test(s)) return '3br';
  if (/^4|4\s*b|penthouse|5/.test(s)) return '4plus';
  return null;
}

const PROCESS_OUTLINES = {
  sale: [
    { title: 'Valuation & strategy', body: 'Formal written valuation and pricing strategy agreed with you', timeframe: 'Day 1-2' },
    { title: 'Form A signing', body: 'RERA Form A mandate signed — your legal protection and our accountability', timeframe: 'Day 2' },
    { title: 'Photography & media', body: 'Professional photography, floor plan, and where suitable 360° tour', timeframe: 'Week 1' },
    { title: 'Listing launch', body: 'Live on Property Finder and partner portals with premium placement', timeframe: 'Week 1' },
    { title: 'Buyer matching & viewings', body: 'Qualified buyers from our live database matched and viewings arranged', timeframe: 'Ongoing' },
    { title: 'Offers & negotiation', body: 'Every offer presented in writing; we negotiate to protect your position', timeframe: 'As received' },
    { title: 'Transfer & handover', body: 'DLD transfer coordinated end-to-end through the Trustee Office', timeframe: 'On acceptance' },
  ],
  rent: [
    { title: 'Rental appraisal', body: 'Written rental appraisal and positioning strategy agreed with you', timeframe: 'Day 1-2' },
    { title: 'Form A signing', body: 'RERA Form A mandate signed — your legal protection and our accountability', timeframe: 'Day 2' },
    { title: 'Photography & media', body: 'Professional photography and floor plan prepared for launch', timeframe: 'Week 1' },
    { title: 'Listing launch', body: 'Live on Property Finder and partner portals with premium placement', timeframe: 'Week 1' },
    { title: 'Tenant screening & viewings', body: 'Tenants pre-qualified on profile and payment terms before viewing', timeframe: 'Ongoing' },
    { title: 'Offer & contract', body: 'Terms negotiated, tenancy contract prepared and Ejari registered', timeframe: 'On acceptance' },
    { title: 'Move-in & handover', body: 'Cheques collected, keys handed over, move-in coordinated', timeframe: 'Contract start' },
  ],
};
PROCESS_OUTLINES.both = PROCESS_OUTLINES.sale;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const writer = buildWriter(user);
    const credibilityBlock = buildCredibilityBlock(writer);

    const body = await req.json().catch(() => ({}));
    const landlord_id = body?.landlord_id;
    if (!landlord_id) return Response.json({ ok: false, error: 'landlord_id required' }, { status: 400 });
    const svc = base44.asServiceRole;

    const landlord = await svc.entities.Landlord.get(landlord_id).catch(() => null);
    if (!landlord) return Response.json({ ok: false, error: 'landlord not found' }, { status: 404 });
    if (!landlord.full_name_en) return Response.json({ ok: false, error: 'landlord has no full_name_en to address' }, { status: 400 });

    // v1 languages: en | ru. Anything else falls back to English.
    const reqLang = clean(body?.language).toLowerCase();
    const lang = ['en', 'ru'].includes(reqLang) ? reqLang : (landlord.preferred_language === 'ru' ? 'ru' : 'en');
    const reqFocus = clean(body?.focus).toLowerCase();
    const focus = ['sale', 'rent', 'both'].includes(reqFocus)
      ? reqFocus
      : (landlord.lead_type === 'landlord_sale' ? 'sale' : landlord.lead_type === 'landlord_rent' ? 'rent' : 'both');

    // ── Gather everything (defensive — every source degrades to empty) ──
    const [lps, directives, priorDossiers, brandVoices] = await Promise.all([
      svc.entities.LandlordProperty.filter({ landlord_id }, '-created_date', 5).catch(() => []),
      svc.entities.LandlordDirective.filter({ landlord_id, status: 'active' }, '-created_date', 3).catch(() => []),
      svc.entities.MandateDossier.filter({ landlord_id }, '-created_date', 50).catch(() => []),
      svc.entities.BrandVoice.filter({ is_active: true }, '-created_date', 1).catch(() => []),
    ]);
    const lp = Array.isArray(lps) && lps.length ? lps[0] : null;

    let project = null;
    if (landlord.project_id) project = await svc.entities.Project.get(landlord.project_id).catch(() => null);

    let property = null;
    if (lp?.property_id) property = await svc.entities.Property.get(lp.property_id).catch(() => null);
    const sizeSqft = property?.area_sqft || property?.size_sqft || property?.built_up_area_sqft || null;

    // ── Market data: latest DXB Interact report for this project (exact then fuzzy) ──
    const projName = clean(landlord.project_name) || clean(project?.name);
    let report = null;
    if (projName) {
      // Prefer deed-database reports (with medians) over portal knowledge pages, then anything with analysis.
      const pickBest = (rows) => {
        const list = (rows || []).filter(Boolean);
        return list.find((r) => r.median_price_aed || r.median_price_sqft)
          || list.find((r) => clean(r.analysis_summary))
          || list[0] || null;
      };
      const exact = await svc.entities.MarketReport.filter({ project_name: projName }, '-report_date', 6).catch(() => []);
      report = pickBest(exact);
      if (!report) {
        const all = await svc.entities.MarketReport.filter({}, '-report_date', 80).catch(() => []);
        const pl = projName.toLowerCase();
        report = pickBest((all || []).filter((r) => {
          const rn = clean(r.project_name).toLowerCase();
          return rn && (rn.includes(pl) || pl.includes(rn));
        }));
      }
    }

    let comps = [];
    if (report?.id) {
      const txAll = await svc.entities.MarketTransaction.filter({ market_report_id: report.id }, '-transaction_date', 80).catch(() => []);
      const valid = (txAll || []).filter((t) => !t.is_outlier && t.price_aed);
      const bucket = bedsBucket(landlord.unit_layout);
      let picked = bucket ? valid.filter((t) => t.bedrooms === bucket) : [];
      if (picked.length < 4) picked = valid; // not enough same-layout comps → show the building
      comps = picked.slice(0, 10).map((t) => ({
        date: t.transaction_date || null,
        beds: t.bedrooms || null,
        sqft: t.area_sqft || null,
        price_aed: t.price_aed || null,
        price_sqft: t.price_per_sqft || (t.price_aed && t.area_sqft ? Math.round(t.price_aed / t.area_sqft) : null),
      }));
    }

    // ── data_snapshot: every figure the PDF will print, computed HERE ──
    const valuation = (lp && lp.ai_estimated_value_aed) ? {
      value_aed: lp.ai_estimated_value_aed,
      price_sqft: lp.ai_estimated_price_sqft || null,
      confidence: lp.ai_valuation_confidence || null,
      basis: clean(lp.ai_valuation_basis).slice(0, 600) || null,
      updated_at: lp.ai_valuation_updated_at || null,
    } : null;

    const anchor = valuation?.value_aed || landlord.asking_price_aed || null;
    const pricing = anchor ? {
      anchor_aed: round1k(anchor),
      premium_aed: round1k(anchor * 1.05),
      market_aed: round1k(anchor),
      fast_aed: round1k(anchor * 0.96),
      anchor_source: valuation?.value_aed ? 'ai_valuation' : 'asking_price',
    } : null;

    const data_snapshot = {
      unit: {
        project_name: projName || null,
        unit_reference: landlord.unit_reference || null,
        unit_layout: landlord.unit_layout || null,
        location: project?.location || 'Business Bay, Dubai',
        developer: project?.developer || null,
        project_image_url: project?.image_url || null,
        tenancy_status: lp?.tenancy_status || null,
        current_rent_aed: lp?.current_rent_aed || null,
        size_sqft: sizeSqft,
        asking_price_aed: landlord.asking_price_aed || null,
      },
      valuation,
      market: report ? {
        report_date: report.report_date || null,
        transactions_count: report.transactions_count || null,
        median_price_aed: report.median_price_aed || null,
        median_price_sqft: report.median_price_sqft || null,
        median_price_sqft_pre_event: report.median_price_sqft_pre_event || null,
        median_price_sqft_post_event: report.median_price_sqft_post_event || null,
      } : null,
      comps,
      pricing,
      focus,
      language: lang,
    };

    // ── Intelligence context for the prose ──
    const cs = (landlord.ai_call_script && typeof landlord.ai_call_script === 'object') ? landlord.ai_call_script : null;
    const hooksBlock = cs && Array.isArray(cs.value_hooks) && cs.value_hooks.length
      ? `REAL VALUE HOOKS (verified figures — you may reference these EXACT facts, never altered):\n${cs.value_hooks.slice(0, 6).map((h) => '- ' + h).join('\n')}` : '';
    const objections = Array.isArray(landlord.ai_objections) ? landlord.ai_objections.slice(0, 4) : [];
    const directiveBlock = (directives || []).filter((d) => d?.directive_text)
      .map((d) => `- [${(d.priority || 'normal').toUpperCase()}] ${clean(d.directive_text).slice(0, 300)}`).join('\n');
    const charter = brandVoices && brandVoices[0] ? clean(brandVoices[0].charter_text).slice(0, 1500) : '';

    const focusLaw = focus === 'rent'
      ? 'FOCUS: RENT — this dossier proposes Erudite as the leasing agent. Speak to rental positioning, tenant quality, Ejari, and protecting the asset. Never discuss selling.'
      : focus === 'sale'
        ? 'FOCUS: SALE — this dossier proposes Erudite for the sale mandate. Speak to sale positioning, buyer reach, negotiation, and DLD transfer. Never pitch leasing.'
        : 'FOCUS: BOTH — the owner may sell or lease. Lead with the sale story; position leasing as the parallel path Erudite runs equally well, so every market outcome is covered.';

    const langLaw = lang === 'ru'
      ? 'LANGUAGE LAW: write EVERY narrative field in natural, senior business Russian (формальное «Вы», по-деловому тепло, без канцелярита). Keep proper nouns (Erudite Real Estate, Property Finder, Business Bay, RERA, Form A, DLD, Ejari) in Latin script.'
      : 'LANGUAGE LAW: write EVERY narrative field in senior, natural business English.';

    const systemPrompt = `You are ${writer.name}, ${writer.position}${writer.isCEO ? '' : ' at Erudite Real Estate'} in Dubai, writing the narrative for a MANDATE DOSSIER — a private, owner-facing proposal document that makes the case for listing this specific property with Erudite. It will be typeset into a branded navy-and-gold PDF and handed to the owner. You write like a senior principal: composed, specific, generous with insight, zero pressure, zero hype.

${credibilityBlock}

${langLaw}

${focusLaw}

DOCUMENT LAWS:
- FIREWALL: you never INVENT a figure. The layout engine prints the valuation, the market medians, the comps table and the pricing scenarios — never restate those specific numbers in your text. You MAY cite a figure ONLY if it appears verbatim in the VERIFIED MARKET INTELLIGENCE or REAL VALUE HOOKS blocks below (capital-gain stories, record prints, yield figures) — quoted exactly as written, never rounded up, never extrapolated.
- Interpret ONLY the verified data supplied. Where a data block is absent, be honest and confident about how it will be produced (formal written valuation within 48 hours of engagement) — never bluff.
- The owner keeps this document. Every sentence must survive being re-read a week later in front of a competing broker.
- No emojis, no exclamation-heavy hype, no "I hope this finds you well", no pleading.
- If a FOUNDER DIRECTIVE is present it OVERRIDES style preferences (never the no-fabrication rule).
${charter ? `\nBRAND VOICE CHARTER (obey):\n${charter}` : ''}`;

    const bucket = bedsBucket(landlord.unit_layout);
    const userPrompt = `Forge the dossier narrative now.

OWNER & UNIT (real facts only):
- Owner: ${landlord.full_name_en} (first name: ${landlord.first_name || landlord.full_name_en.split(' ')[0]})
- Nationality: ${landlord.nationality || 'unknown'} · Archetype: ${landlord.landlord_archetype || 'unknown'} (calibrate tone and emphasis; never name it back to them)
- UAE resident: ${landlord.is_resident_uae ? 'yes' : 'no/unknown'} · Residence: ${landlord.residence_country || 'unknown'}
- Project: ${projName || '(unknown — do not invent)'} · Unit: ${landlord.unit_reference || '(unknown — do not invent)'}${landlord.unit_layout ? ` · Layout: ${landlord.unit_layout}` : ''}${sizeSqft ? ` · ~${sizeSqft} sqft` : ''}
- Tenancy: ${lp?.tenancy_status || 'unknown'} · Stage: ${landlord.stage || 'unknown'} · Rapport: ${landlord.rapport_level || 'cold'} · Mandate status: ${landlord.mandate_status || 'none'}
- Listed with another broker: ${landlord.is_currently_listed_with_others ? 'YES — be additive, never attack the other broker' : 'no/unknown'}

VERIFIED DATA THE LAYOUT WILL PRINT (write AROUND these; do not restate the figures):
- AI valuation block: ${valuation ? `PRESENT (confidence ${valuation.confidence || 'n/a'}; basis: ${valuation.basis || 'DLD transaction comps'})` : 'ABSENT — promise the formal written valuation within 48 hours of engagement'}
- Market block: ${report ? `PRESENT — DXB Interact report dated ${report.report_date || 'n/a'}, ${report.transactions_count || comps.length || 'several'} recorded transactions in the building` : 'ABSENT'}
- Comps table: ${comps.length ? `${comps.length} recorded transactions${bucket ? ` (prioritized ${bucket})` : ''}` : 'none'}
- Pricing scenarios: ${pricing ? `PRESENT (anchored on ${pricing.anchor_source === 'ai_valuation' ? 'the AI valuation' : "the owner's asking price"})` : 'ABSENT — pricing follows the formal valuation'}
${report && clean(report.analysis_summary) ? `
VERIFIED MARKET INTELLIGENCE (deed-level analysis for this building — the persuasive core of this dossier; every figure here is verified and may be quoted exactly as written):
${clean(report.analysis_summary).slice(0, 3000)}` : ''}

BRAIN INTELLIGENCE (calibrate the letter and the exclusivity case from this; reference situations, never scores):
- Rolling summary: ${clean(landlord.ai_rolling_summary).slice(0, 700) || '(none)'}
- Deal thesis: ${clean(landlord.ai_deal_thesis).slice(0, 700) || '(none)'}
${objections.length ? `- Known objection landscape (pre-empt quietly, never name as objections): ${objections.join(' | ')}` : ''}
${hooksBlock ? `\n${hooksBlock}` : ''}
${directiveBlock ? `\nFOUNDER DIRECTIVES (obey):\n${directiveBlock}` : ''}

PROCESS OUTLINE (localize these exact steps into the dossier language — same order, same meaning, never invent steps):
${PROCESS_OUTLINES[focus].map((s, i) => `${i + 1}. ${s.title} — ${s.body} [${s.timeframe}]`).join('\n')}

Language code for every field: ${lang}`;

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 1,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [{ name: 'forge_mandate_dossier', description: 'Emit the forged mandate dossier narrative.', input_schema: DOSSIER_SCHEMA }],
      tool_choice: { type: 'tool', name: 'forge_mandate_dossier' },
    });
    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    const narrative = toolBlock ? toolBlock.input : null;
    if (!narrative) return Response.json({ ok: false, error: 'forge produced no narrative' }, { status: 502 });

    const nowIso = new Date().toISOString();
    const version = (Array.isArray(priorDossiers) ? priorDossiers.length : 0) + 1;
    const record = await svc.entities.MandateDossier.create({
      landlord_id,
      version,
      language: lang,
      focus,
      status: 'forged',
      narrative,
      data_snapshot,
      generated_by_email: writer.email,
      generated_by_name: writer.name,
      model: MODEL,
      forged_at: nowIso,
    });

    return Response.json({
      ok: true,
      dossier_id: record?.id || null,
      version,
      language: lang,
      focus,
      narrative,
      data_snapshot,
      writer: { name: writer.name, position: writer.position, is_ceo: writer.isCEO },
      owner_name: landlord.full_name_en,
      forged_at: nowIso,
    });
  } catch (error) {
    console.error('forgeMandateDossier error:', error);
    return Response.json({ ok: false, error: String((error as Error)?.message || error) }, { status: 500 });
  }
});
