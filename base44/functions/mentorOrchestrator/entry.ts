import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * mentorOrchestrator — THE 17 / Erudite Academy mentor brain (Phase 3).
 *
 * The reasoning loop behind HALL/MIRROR/DOJO/FIELD/COUNCIL: perceives the
 * agent's training state + live CRM signals, retrieves doctrine from the
 * DoctrineNode codex (+ CorpusChunk grounding), reasons at the right tier,
 * replies as the mentor, and writes what it learned back to memory.
 *
 * POST body:
 *   { user_email, message, session_id? }                       → chat
 *   { user_email, trigger: 'proactive_directive', trigger_detail? } → daemon nudge
 *   { user_email, trigger: 'weekly_review' }                   → Friday deep review
 *   optional: requested_tier ('haiku'|'sonnet'|'opus') — hint, never downgrades weekly_review
 *
 * TIERS: haiku = quick factual/philosophy Q&A; sonnet = coaching + proactive
 * directives; opus = weekly_review. Same Anthropic forced-tool-use pattern as
 * landlordOrchestrator.
 *
 * RETRIEVAL: keyword/tag scoring over DoctrineNodes (module-scope cached) and
 * current-week CorpusChunks. No embeddings yet — when OPENAI_API_KEY lands and
 * chunks are vectorized (academyIngest mode:embed_backfill), swap scoreChunks
 * for cosine over CorpusChunk.embedding.
 *
 * CONTENT LAW: CorpusChunk text is machine-side grounding only. The mentor
 * speaks in its own words; at most ONE short quotation (<15 words) per reply.
 *
 * LEARN: writes agent+mentor MentorMessage rows, appends a dated line to
 * MentorProfile.coaching_notes, bumps interaction_count, refreshes
 * current_focus_principle / chief_aim_snapshot, appends experiments when a
 * tactic is assigned. Experiment OUTCOME closure is mentorSweep's job (Phase 4).
 *
 * NOTE: TrainingPrinciple has two record sets per week (a slugged Hill set and
 * a slug-less rank ladder) — we use the slugged set only.
 */

const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-4-8',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// ── module-scope caches (warm invocations skip refetch) ──
let NODE_CACHE = { at: 0, nodes: [] };
const CHUNK_CACHE = new Map(); // principle_number -> { at, chunks }
const CACHE_MS = 10 * 60 * 1000;

async function getNodes(svc) {
  if (Date.now() - NODE_CACHE.at > CACHE_MS || !NODE_CACHE.nodes.length) {
    NODE_CACHE = { at: Date.now(), nodes: await svc.entities.DoctrineNode.list('week_number', 500) };
  }
  return NODE_CACHE.nodes;
}

async function getChunks(svc, principleNumber) {
  const hit = CHUNK_CACHE.get(principleNumber);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.chunks;
  const chunks = await svc.entities.CorpusChunk.filter({ principle_number: principleNumber });
  CHUNK_CACHE.set(principleNumber, { at: Date.now(), chunks });
  return chunks;
}

const STOP = new Set(['the','a','an','and','or','but','is','are','was','be','to','of','in','on','for','with','my','i','me','you','your','it','this','that','what','how','do','does','about','can','at','as','not','no','so','we','our']);
const tokenize = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

function scoreNodes(nodes, queryTokens, currentWeek) {
  const q = new Set(queryTokens);
  return nodes
    .map((n) => {
      let s = 0;
      for (const t of n.tags || []) { const tt = tokenize(t); for (const w of tt) if (q.has(w)) s += 3; }
      for (const w of tokenize(n.title)) if (q.has(w)) s += 2;
      const bodyTokens = tokenize(n.body);
      const bodySet = new Set(bodyTokens);
      for (const w of q) if (bodySet.has(w)) s += 1;
      if (n.week_number === currentWeek) s += 2;
      if (n.node_type === 'principle' && n.week_number === currentWeek) s += 2;
      return { n, s };
    })
    .sort((a, b) => b.s - a.s);
}

function scoreChunks(chunks, queryTokens) {
  const q = new Set(queryTokens);
  return chunks
    .map((c) => {
      let s = 0;
      for (const w of tokenize(c.summary)) if (q.has(w)) s += 3;
      const bodySet = new Set(tokenize(c.chunk_text));
      for (const w of q) if (bodySet.has(w)) s += 1;
      return { c, s };
    })
    .sort((a, b) => b.s - a.s);
}

const daysAgo = (d) => { const x = new Date(d); return isNaN(x) ? null : Math.floor((Date.now() - x.getTime()) / 86400000); };

async function gatherCrmSignals(svc, email) {
  const out = { landlords_total: 0, landlords_active: 0, silent: [], top_urgent: [], followups_overdue: 0, calls_7d: 0, calls_weekly_baseline: null, affirmation_streak: 0, affirmed_today: false };
  try {
    const landlords = await svc.entities.Landlord.filter({ assigned_agent_email: email });
    out.landlords_total = landlords.length;
    const active = landlords.filter((l) => l.stage && l.stage !== 'deal_closed');
    out.landlords_active = active.length;
    out.silent = active
      .map((l) => ({ name: l.full_name_en || l.first_name || l.unit_reference || 'unnamed', project: l.project_name || '', days: daysAgo(l.updated_date) }))
      .filter((x) => x.days != null && x.days >= 7)
      .sort((a, b) => b.days - a.days)
      .slice(0, 3);
    out.top_urgent = active
      .filter((l) => typeof l.urgency_score === 'number')
      .sort((a, b) => b.urgency_score - a.urgency_score)
      .slice(0, 3)
      .map((l) => ({ name: l.full_name_en || l.first_name || 'unnamed', project: l.project_name || '', stage: l.stage, urgency: l.urgency_score }));
  } catch (_) { /* signal optional */ }
  try {
    const fu = await svc.entities.Followup.filter({ agent_email: email, status: 'pending' });
    out.followups_overdue = fu.filter((f) => f.scheduled_at && new Date(f.scheduled_at) < new Date()).length;
  } catch (_) { /* optional */ }
  try {
    const calls = await svc.entities.CallLog.filter({ agent_email: email }, '-started_at', 300);
    const d7 = calls.filter((c) => daysAgo(c.started_at) != null && daysAgo(c.started_at) < 7).length;
    const d28 = calls.filter((c) => daysAgo(c.started_at) != null && daysAgo(c.started_at) < 28).length;
    out.calls_7d = d7;
    out.calls_weekly_baseline = d28 > d7 ? Math.round((d28 - d7) / 3) : null;
  } catch (_) { /* optional */ }
  try {
    const logs = await svc.entities.DailyAffirmationLog.filter({ user_email: email }, '-log_date', 1);
    if (logs[0]) {
      out.affirmation_streak = logs[0].current_streak || 0;
      out.affirmed_today = logs[0].log_date === new Date().toISOString().slice(0, 10) && !!logs[0].affirmed;
    }
  } catch (_) { /* optional */ }
  return out;
}

function resolveTier({ trigger, message, requestedTier }) {
  if (trigger === 'weekly_review') return 'opus';
  if (trigger) return 'sonnet';
  if (requestedTier && MODELS[requestedTier]) return requestedTier;
  const t = String(message || '').toLowerCase();
  const coachy = /\b(i|my|me|struggl|stuck|afraid|fear|lost|frustrat|landlord|deal|mandate|pipeline|client|reject|quiet|silent|ghost|commission|help me|advice)\b/;
  if (message && message.length < 220 && !coachy.test(t)) return 'haiku';
  return 'sonnet';
}

const MENTOR_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: "The mentor's message to the agent, in the mentor's own original words." },
    action: {
      type: ['object', 'null'],
      description: 'ONE concrete action for coaching/directive/review replies; null for pure factual Q&A.',
      properties: {
        title: { type: 'string', description: 'Imperative, specific, doable today or this week.' },
        why: { type: 'string' },
        linked_slug: { type: 'string', description: 'DoctrineNode slug this action applies.' },
      },
      required: ['title'],
    },
    principle_slug: { type: 'string', description: 'The principle this reply centers on.' },
    context_slugs_used: { type: 'array', items: { type: 'string' }, description: 'Doctrine slugs actually drawn on.' },
    coaching_note: { type: 'string', description: "ONE line for the mentor's private memory of this agent — observation, not summary. Do NOT include any date; it is stamped automatically." },
    experiment: {
      type: ['object', 'null'],
      description: 'Only when assigning a NEW measurable tactic: {tactic, metric}. Else null.',
      properties: { tactic: { type: 'string' }, metric: { type: 'string' } },
    },
  },
  required: ['reply', 'principle_slug', 'coaching_note'],
};

function buildSystem(kind) {
  return `You are THE MENTOR of Erudite Academy — the living voice of Napoleon Hill's 17 principles inside a Dubai real-estate brokerage (Erudite Real Estate). You coach one agent at a time.

VOICE: firm, warm, dignified. A master teacher who has closed deals himself. Never corporate, never fluffy, never scolding. Speak directly to the agent by name when known.

LAWS (absolute):
1. Ground every claim in the DOCTRINE NODES provided — they are your own long-term memory. Reference their ideas naturally; never dump them.
2. The RAW CORPUS passages are for YOUR grounding only — never reproduce them. You may use AT MOST ONE short quotation (under 15 words) per reply, only when it lands.
3. When LIVE CRM SIGNALS exist, tie the advice to them concretely ("your Marina Gate file, silent 9 days" beats any generality). If no signals exist, coach on the training material and the agent's own words — never invent data.
4. ${kind === 'qa' ? 'This is a quick question — answer it cleanly and completely. No forced action item (action: null is fine).' : 'End with exactly ONE concrete action the agent can execute today or this week.'}
5. Reply length: ${kind === 'weekly_review' ? '250-400 words — a true weekly review: what the week was for, what the data shows, what to carry forward, the one order for next week.' : kind === 'qa' ? 'under 150 words.' : '120-250 words.'}
6. The coaching_note is your private memory: one sharp dated observation about THIS agent (patterns, resistances, wins) — not a summary of your reply.`;
}

async function callClaude(system, prompt, model) {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: prompt }],
    tools: [{ name: 'emit_mentor', description: 'Emit the mentor reply package.', input_schema: MENTOR_SCHEMA }],
    tool_choice: { type: 'tool', name: 'emit_mentor' },
  });
  const block = response.content.find((b) => b.type === 'tool_use');
  return block ? block.input : null;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { user_email, message, trigger, trigger_detail, requested_tier, session_id } = body;
    if (!user_email) return json(400, { error: 'user_email required' });
    if (!message && !trigger) return json(400, { error: 'message or trigger required' });

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // ── PERCEIVE ──
    const [enrollments, profiles, aims] = await Promise.all([
      svc.entities.TrainingEnrollment.filter({ user_email, status: 'active' }),
      svc.entities.MentorProfile.filter({ user_email }),
      svc.entities.ChiefAim.filter({ user_email }),
    ]);
    const enrollment = enrollments[0] || null;
    const week = enrollment?.current_week || 1;
    let profile = profiles[0] || null;
    const aim = aims.find((a) => a.status === 'active') || aims[aims.length - 1] || null;

    const [weekPrinciples, recentMsgs, reflections, signals] = await Promise.all([
      svc.entities.TrainingPrinciple.filter({ week_number: week }),
      svc.entities.MentorMessage.filter({ user_email }, '-created_date', 10),
      svc.entities.TrainingReflection.filter({ user_email, week_number: week }),
      gatherCrmSignals(svc, user_email),
    ]);
    const weekPrinciple = weekPrinciples.find((p) => p.slug) || weekPrinciples[0] || null; // slugged Hill set wins

    // ── RETRIEVE ──
    const queryText = [message || '', trigger || '', trigger_detail || '', weekPrinciple?.slug || ''].join(' ');
    const qTokens = tokenize(queryText);
    const nodes = await getNodes(svc);
    const topNodes = scoreNodes(nodes, qTokens, week).slice(0, 6).filter((x) => x.s > 0 || x.n.week_number === week).map((x) => x.n);
    if (!topNodes.some((n) => n.node_type === 'principle' && n.week_number === week)) {
      const pn = nodes.find((n) => n.node_type === 'principle' && n.week_number === week);
      if (pn) topNodes.unshift(pn);
    }
    const chunks = await getChunks(svc, week);
    const topChunks = scoreChunks(chunks, qTokens).slice(0, 2).map((x) => x.c);

    // ── COMPOSE PROMPT ──
    const tier = resolveTier({ trigger, message, requested_tier: requested_tier });
    const kind = trigger === 'weekly_review' ? 'weekly_review' : trigger ? 'directive' : (tier === 'haiku' ? 'qa' : 'coaching');
    const history = recentMsgs.reverse().map((m) => `${m.role === 'mentor' ? 'MENTOR' : 'AGENT'}: ${String(m.message).slice(0, 400)}`).join('\n');

    const prompt = [
      `TODAY: ${new Date().toISOString().slice(0, 10)}`,
      `AGENT: ${enrollment?.agent_name || user_email} | training week ${week} of 17 (${weekPrinciple?.slug || 'unknown principle'})${weekPrinciple?.rank_title ? ` | current rank: ${weekPrinciple.rank_title}` : ''}`,
      aim ? `CHIEF AIM: "${aim.aim_statement}"${aim.target_figure_aed ? ` | target AED ${aim.target_figure_aed}` : ''}${aim.target_date ? ` by ${aim.target_date}` : ''}` : 'CHIEF AIM: none written yet — a standing gap worth addressing.',
      `LIVE CRM SIGNALS: ${out2str(signals)}`,
      reflections.length ? `WEEK ${week} REFLECTION: submitted.` : `WEEK ${week} REFLECTION: not yet submitted.`,
      profile?.coaching_notes ? `YOUR PRIVATE NOTES ON THIS AGENT (recent):\n${String(profile.coaching_notes).split('\n').slice(-8).join('\n')}` : 'YOUR PRIVATE NOTES: none yet — first substantive contact.',
      profile?.experiments?.length ? `OPEN EXPERIMENTS: ${JSON.stringify(profile.experiments.filter((e) => e.outcome === 'pending').slice(-3))}` : '',
      history ? `RECENT CONVERSATION:\n${history}` : '',
      `DOCTRINE NODES (your long-term memory — ground the reply here):\n${topNodes.map((n) => `[${n.slug}] (${n.node_type}) ${n.title}: ${n.body}`).join('\n\n')}`,
      topChunks.length ? `RAW CORPUS (grounding only — never reproduce):\n${topChunks.map((c) => `(${c.summary}) ${String(c.chunk_text).slice(0, 1500)}`).join('\n---\n')}` : '',
      trigger === 'weekly_review'
        ? `TASK: Conduct the week-${week} WEEKLY REVIEW for this agent. Weigh the signals honestly, name what improved and what slipped, and set the order for next week.`
        : trigger
          ? `TASK: Proactive directive. Reason: ${trigger_detail || trigger}. Reach out first — the agent did not write to you. Make it land personally.`
          : `AGENT'S MESSAGE:\n${message}`,
    ].filter(Boolean).join('\n\n');

    // ── REASON ──
    const result = await callClaude(buildSystem(kind), prompt, MODELS[tier]);
    if (!result?.reply) return json(502, { error: 'model returned no reply' });

    // ── LEARN ──
    const sid = session_id || `${user_email}-${new Date().toISOString().slice(0, 10)}`;
    const contextUsed = Array.isArray(result.context_slugs_used) && result.context_slugs_used.length
      ? result.context_slugs_used : topNodes.map((n) => n.slug);
    const writes = [];
    if (message) {
      writes.push(svc.entities.MentorMessage.create({
        user_email, role: 'agent', message: String(message), session_id: sid, message_kind: 'chat',
      }));
    }
    writes.push(svc.entities.MentorMessage.create({
      user_email, role: 'mentor', message: result.reply, session_id: sid,
      message_kind: trigger || 'chat', model_tier: tier, trigger: trigger || null,
      principle_slug: result.principle_slug || weekPrinciple?.slug || null,
      context_used: contextUsed,
    }));

    const today = new Date().toISOString().slice(0, 10);
    const noteLine = `[${today}] ${result.coaching_note || 'interaction'}`;
    const profileUpdate = {
      coaching_notes: profile?.coaching_notes ? `${profile.coaching_notes}\n${noteLine}` : noteLine,
      interaction_count: (profile?.interaction_count || 0) + 1,
      last_interaction_at: new Date().toISOString(),
      current_focus_principle: result.principle_slug || weekPrinciple?.slug || null,
      ...(aim ? { chief_aim_snapshot: aim.aim_statement } : {}),
      ...(enrollment?.agent_name ? { agent_name: enrollment.agent_name } : {}),
    };
    if (result.experiment?.tactic) {
      profileUpdate.experiments = [
        ...(profile?.experiments || []),
        { tactic: result.experiment.tactic, started: today, metric: result.experiment.metric || '', outcome: 'pending' },
      ];
    }
    writes.push(profile
      ? svc.entities.MentorProfile.update(profile.id, profileUpdate)
      : svc.entities.MentorProfile.create({ user_email, ...profileUpdate }));

    await Promise.all(writes);

    return json(200, {
      ok: true, tier, model: MODELS[tier], session_id: sid,
      reply: result.reply, action: result.action || null,
      principle_slug: result.principle_slug, context_used: contextUsed,
      signals_summary: signals,
    });
  } catch (error) {
    console.error('mentorOrchestrator error:', error);
    return json(500, { error: String(error?.message || error) });
  }
});

function out2str(s) {
  const parts = [];
  parts.push(`${s.landlords_active}/${s.landlords_total} active landlord files`);
  if (s.silent.length) parts.push(`SILENT: ${s.silent.map((x) => `${x.name}${x.project ? ` (${x.project})` : ''} ${x.days}d`).join('; ')}`);
  if (s.top_urgent.length) parts.push(`most urgent: ${s.top_urgent.map((x) => `${x.name}${x.project ? ` (${x.project})` : ''} [${x.stage}]`).join('; ')}`);
  parts.push(`${s.followups_overdue} follow-ups overdue`);
  parts.push(`calls last 7d: ${s.calls_7d}${s.calls_weekly_baseline != null ? ` (baseline ${s.calls_weekly_baseline}/wk)` : ''}`);
  parts.push(`affirmation streak: ${s.affirmation_streak}${s.affirmed_today ? ' (done today)' : ' (NOT done today)'}`);
  return parts.join(' | ');
}