import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * academyIngest — THE 17 / Erudite Academy corpus ingestion endpoint.
 *
 * Receives batches of pre-chunked corpus passages from the LOCAL ingestion
 * pipeline (the only writer of CorpusChunk.chunk_text — company-owned source
 * material, internal retrieval only, never surfaced raw to users). Per chunk:
 *   1. embedding  — OpenAI text-embedding-3-small @ 512 dims (rounded to 5dp
 *                   to keep stored vectors light for runtime cosine retrieval)
 *   2. summary    — one ORIGINAL line via Haiku (citation display; no quotes)
 *   3. create     — CorpusChunk via service role, idempotent on
 *                   (source, chunk_index): existing chunks are skipped.
 *
 * NOT scheduled. Invoked directly by the ingestion driver with the guard
 * token below (this app's functions answer publicly, so the function guards
 * itself — same pattern as evolutionWebhook's ?secret=). Re-used for the
 * Phase 5 audio-lecture ingestion (source: audio_lecture_NN).
 *
 * POST body: { token, dry_run?, chunks: [{ source, principle_number,
 *              chunk_index, line_start, line_end, token_count, chunk_text }] }
 *   - dry_run: runs embedding+summary for the FIRST chunk only, writes
 *     nothing — validates both provider keys end-to-end.
 *   - max 10 chunks per call.
 */

const INGEST_TOKEN = 'f7c30bd61cb65dc38d63afb648b3e2a6a6eaa9dced3c6554';
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMS = 512;
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
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

  const chunks = Array.isArray(body.chunks) ? body.chunks : [];
  if (!chunks.length) return json(400, { error: 'chunks[] required' });
  if (chunks.length > 10) return json(400, { error: 'max 10 chunks per call' });

  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  if (body.dry_run === true) {
    const c = chunks[0];
    const [vector, summary] = await Promise.all([embed(c.chunk_text), summarize(anthropic, c.chunk_text)]);
    return json(200, {
      dry_run: true,
      embed_model: EMBED_MODEL,
      embed_dims: vector.length,
      sample_vector_head: vector.slice(0, 5),
      sample_summary: summary,
      chunk_index: c.chunk_index,
    });
  }

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

        const [vector, summary] = await Promise.all([embed(c.chunk_text), summarize(anthropic, c.chunk_text)]);
        const record = await svc.entities.CorpusChunk.create({
          source: c.source,
          principle_number: c.principle_number,
          chunk_index: c.chunk_index,
          line_start: c.line_start,
          line_end: c.line_end,
          token_count: c.token_count,
          chunk_text: c.chunk_text,
          embedding: vector,
          summary,
        });
        return { chunk_index: c.chunk_index, status: 'created', id: record.id };
      } catch (err) {
        return { chunk_index: c.chunk_index, status: 'error', error: String(err?.message || err).slice(0, 300) };
      }
    }),
  );

  const tally = { created: 0, skipped_existing: 0, error: 0 };
  for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
  return json(200, { embed_model: EMBED_MODEL, embed_dims: EMBED_DIMS, tally, results });
});
