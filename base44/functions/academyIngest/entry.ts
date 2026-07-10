import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * academyIngest — THE 17 / Erudite Academy corpus ingestion endpoint.
 *
 * Receives batches of pre-chunked corpus passages from the LOCAL ingestion
 * pipeline (the only writer of CorpusChunk.chunk_text — company-owned source
 * material, internal retrieval only, never surfaced raw to users). Per chunk:
 *   1. summary    — one ORIGINAL line via Haiku (citation display; no quotes)
 *   2. embedding  — OpenAI text-embedding-3-small @ 512 dims (rounded to 5dp)
 *                   IF OPENAI_API_KEY is set; otherwise records are written
 *                   without vectors and mode:'embed_backfill' fills them in
 *                   later (run it once the key lands in Base44 secrets).
 *   3. create     — CorpusChunk via service role, idempotent on
 *                   (source, chunk_index): existing chunks are skipped.
 *
 * NOT scheduled. Invoked directly by the ingestion driver with the guard
 * token below (this app's functions answer publicly, so the function guards
 * itself — same pattern as evolutionWebhook's ?secret=). Re-used for the
 * Phase 5 audio-lecture ingestion (source: audio_lecture_NN).
 *
 * POST body:
 *   { token, dry_run: true, chunks: [c] }        → key/provider health check, writes nothing
 *   { token, chunks: [c, ...] }                  → ingest (max 10 per call)
 *   { token, mode: 'embed_backfill', limit? }    → embed up to `limit` (default 20)
 *                                                  existing chunks that lack vectors
 * chunk c: { source, principle_number, chunk_index, line_start, line_end,
 *            token_count, chunk_text }
 */

const INGEST_TOKEN = 'f7c30bd61cb65dc38d63afb648b3e2a6a6eaa9dced3c6554';
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMS = 512;
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function embed(text) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not set in function env');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text, dimensions: EMBED_DIMS }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.data[0].embedding.map((x) => Math.round(x * 1e5) / 1e5);
}

async function summarize(anthropic, text) {
  const msg = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 100,
    system:
      'You index an internal corpus. Reply with ONE original line (max 20 words) stating what the passage covers, ' +
      'suitable as a citation label. Use your own words only — never copy or quote phrases from the passage. ' +
      'No preamble, no quotation marks, just the line.',
    messages: [{ role: 'user', content: text }],
  });
  return msg.content[0].text.trim();
}

Deno.serve(async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON body' });
  }
  if (body?.token !== INGEST_TOKEN) return json(401, { error: 'unauthorized' });

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const openaiPresent = !!Deno.env.get('OPENAI_API_KEY');

    // ── embed_backfill: vectorize existing chunks that lack embeddings ──
    if (body.mode === 'embed_backfill') {
      if (!openaiPresent) return json(400, { error: 'OPENAI_API_KEY not set — nothing to do' });
      const limit = Math.min(Number(body.limit) || 20, 50);
      const all = await svc.entities.CorpusChunk.list('chunk_index', 1000);
      const pending = all.filter((c) => !Array.isArray(c.embedding) || c.embedding.length === 0);
      const targets = pending.slice(0, limit);
      const results = await Promise.all(
        targets.map(async (c) => {
          try {
            const vector = await embed(c.chunk_text);
            await svc.entities.CorpusChunk.update(c.id, { embedding: vector });
            return { chunk_index: c.chunk_index, source: c.source, status: 'embedded' };
          } catch (err) {
            return { chunk_index: c.chunk_index, source: c.source, status: 'error', error: String(err?.message || err).slice(0, 300) };
          }
        }),
      );
      const embedded = results.filter((r) => r.status === 'embedded').length;
      return json(200, {
        mode: 'embed_backfill', embed_model: EMBED_MODEL, embed_dims: EMBED_DIMS,
        embedded, errors: results.filter((r) => r.status === 'error'),
        remaining_without_embedding: pending.length - embedded,
      });
    }

    const chunks = Array.isArray(body.chunks) ? body.chunks : [];
    if (!chunks.length) return json(400, { error: 'chunks[] required' });
    if (chunks.length > 10) return json(400, { error: 'max 10 chunks per call' });

    // ── dry_run: provider health check, writes nothing ──
    if (body.dry_run === true) {
      const c = chunks[0];
      const out = { dry_run: true, openai_key_present: openaiPresent, chunk_index: c.chunk_index };
      out.sample_summary = await summarize(anthropic, c.chunk_text);
      if (openaiPresent) {
        const vector = await embed(c.chunk_text);
        out.embed_model = EMBED_MODEL;
        out.embed_dims = vector.length;
        out.sample_vector_head = vector.slice(0, 5);
      }
      return json(200, out);
    }

    // ── ingest ──
    const results = await Promise.all(
      chunks.map(async (c) => {
        try {
          for (const f of ['source', 'principle_number', 'chunk_index', 'chunk_text']) {
            if (c[f] === undefined || c[f] === null) throw new Error(`missing field ${f}`);
          }
          const existing = await svc.entities.CorpusChunk.filter({
            source: c.source,
            chunk_index: c.chunk_index,
          });
          if (existing.length > 0) return { chunk_index: c.chunk_index, status: 'skipped_existing' };

          const [summary, vector] = await Promise.all([
            summarize(anthropic, c.chunk_text),
            openaiPresent ? embed(c.chunk_text) : Promise.resolve(null),
          ]);
          const record = await svc.entities.CorpusChunk.create({
            source: c.source,
            principle_number: c.principle_number,
            chunk_index: c.chunk_index,
            line_start: c.line_start,
            line_end: c.line_end,
            token_count: c.token_count,
            chunk_text: c.chunk_text,
            ...(vector ? { embedding: vector } : {}),
            summary,
          });
          return { chunk_index: c.chunk_index, status: 'created', id: record.id, embedded: !!vector };
        } catch (err) {
          return { chunk_index: c.chunk_index, status: 'error', error: String(err?.message || err).slice(0, 300) };
        }
      }),
    );

    const tally = { created: 0, skipped_existing: 0, error: 0 };
    for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
    return json(200, { openai_key_present: openaiPresent, tally, results });
  } catch (err) {
    return json(500, { error: String(err?.message || err).slice(0, 500) });
  }
});