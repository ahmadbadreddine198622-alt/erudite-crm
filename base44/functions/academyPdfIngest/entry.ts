import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * academyPdfIngest — Admin-only PDF upload for THE 17 curriculum.
 *
 * Two-pass Claude extraction for reliability:
 *   Pass 1: Extract all 17 structured principles (full lessons, drills, quizzes)
 *   Pass 2: Extract the complete raw text of the document
 *
 * Then: chunk the raw text, generate a one-line summary per chunk via Haiku,
 * and store as CorpusChunk records (source: "book") — replacing any old ones.
 *
 * The mentor brain (mentorOrchestrator) searches ALL chunks by keyword to
 * ground its replies in the full book.
 *
 * POST { file_url }
 */

const MODEL = 'claude-sonnet-5';
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';
const CHUNK_SIZE = 1200;
const SUMMARY_BATCH = 8;

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function stripJsonFence(raw) {
  return raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // ── Fetch the PDF ──
    const pdfRes = await fetch(file_url);
    if (!pdfRes.ok) return Response.json({ error: `Failed to fetch PDF: ${pdfRes.status}` }, { status: 500 });
    const pdfBuf = await pdfRes.arrayBuffer();
    const pdfBase64 = bufToBase64(pdfBuf);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const svc = base44.asServiceRole;

    console.log(`[academyPdfIngest] PDF fetched (${pdfBuf.byteLength} bytes)`);

    // ════════════════════════════════════════════════════════════
    // PASS 1: Extract all 17 structured principles
    // ════════════════════════════════════════════════════════════
    console.log('[academyPdfIngest] Pass 1: extracting 17 structured principles…');
    const principlesMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 64000,
      system:
        'You are an expert curriculum architect for a 17-week real estate sales mastery program called "THE 17", based on Napoleon Hill\'s 17 Principles of Success. ' +
        'You receive a PDF containing the full curriculum (the book "Think and Grow Rich" / "The 17 Principles of Personal Achievement" or similar). ' +
        'Extract EVERY weekly principle as structured JSON — be exhaustive and thorough. ' +
        'You MUST extract all 17 weeks. For each week, capture the COMPLETE lesson text (not a summary), ALL daily drills, and create 3-5 quiz questions. ' +
        'Return ONLY valid JSON — no markdown, no fences, no commentary.',
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          {
            type: 'text',
            text: [
              'Extract all 17 weekly principles from this book as a single JSON object with this exact shape:',
              '{"principles": [',
              '  {"week_number": 1, "name": "...", "slug": "week-01-kebab-case", "tagline": "short punchy tagline",',
              '   "rank_title": "rank name for completing this week", "directive_text": "the single directive for this week",',
              '   "essence": "2-3 sentence essence summary",',
              '   "erudite_lesson": "FULL multi-paragraph lesson text with \\n\\n between paragraphs — this must be the COMPLETE lesson, not a summary",',
              '   "reading_assignment": "specific reading assignment for this week",',
              '   "daily_drills": ["drill 1", "drill 2", "drill 3", "drill 4", "drill 5"],',
              '   "reflection_prompt": "a deep reflection question for this week",',
              '   "quiz_questions": [{"question": "...", "options": ["a","b","c","d"], "correct_index": 0}, ...]',
              '  },',
              '  ... (all 17 weeks) ...',
              ']}',
              '',
              'CRITICAL RULES:',
              '- Extract ALL 17 weeks. Do not stop early.',
              '- erudite_lesson must be the FULL lesson text (300-800 words per week), not a summary.',
              '- daily_drills should have 3-7 actionable items per week.',
              '- quiz_questions should have 3-5 items per week with 4 options each.',
              '- slug format: "week-NN-kebab-case-name" (e.g. "week-01-definiteness-of-purpose").',
              '- If the book does not explicitly name a principle for a week, synthesize the best fit from the content.',
            ].join('\n'),
          },
        ],
      }],
    });

    const principlesRaw = principlesMsg.content.find((b) => b.type === 'text')?.text || '';
    const principlesData = JSON.parse(stripJsonFence(principlesRaw));
    const principles = Array.isArray(principlesData.principles) ? principlesData.principles : [];
    console.log(`[academyPdfIngest] Pass 1 complete: extracted ${principles.length} principles`);

    // ════════════════════════════════════════════════════════════
    // PASS 2: Extract the complete raw text
    // ════════════════════════════════════════════════════════════
    console.log('[academyPdfIngest] Pass 2: extracting full text…');
    const textMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 64000,
      system:
        'You are a text extraction engine. You receive a PDF book. ' +
        'Extract the COMPLETE text of the book — every page, every chapter, every principle. ' +
        'Return ONLY the raw text. No JSON, no markdown, no commentary. ' +
        'Preserve paragraph breaks with double newlines. ' +
        'If the text is very long, prioritize completeness over formatting — do not truncate.',
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          {
            type: 'text',
            text: 'Extract the complete text of this book. Include every chapter and every principle. Do not summarize or truncate. Output raw text only.',
          },
        ],
      }],
    });

    const fullText = textMsg.content.find((b) => b.type === 'text')?.text || '';
    console.log(`[academyPdfIngest] Pass 2 complete: ${fullText.length} chars of text`);

    // ════════════════════════════════════════════════════════════
    // UPSERT PRINCIPLES
    // ════════════════════════════════════════════════════════════
    const principleResults = [];
    for (const p of principles) {
      try {
        if (!p.week_number || !p.name) continue;
        if (!p.slug) {
          p.slug = `week-${String(p.week_number).padStart(2, '0')}-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
        }
        const existing = await svc.entities.TrainingPrinciple.filter({ week_number: p.week_number });
        if (existing[0]) {
          await svc.entities.TrainingPrinciple.update(existing[0].id, p);
          principleResults.push({ week: p.week_number, name: p.name, status: 'updated' });
        } else {
          await svc.entities.TrainingPrinciple.create(p);
          principleResults.push({ week: p.week_number, name: p.name, status: 'created' });
        }
      } catch (err) {
        principleResults.push({ week: p.week_number, status: 'error', error: String(err?.message || err).slice(0, 200) });
      }
    }

    // ════════════════════════════════════════════════════════════
    // CHUNK TEXT + GENERATE SUMMARIES + STORE CORPUS
    // ════════════════════════════════════════════════════════════
    let corpusCreated = 0;

    if (fullText.length > 100) {
      // Delete old chunks from previous ingestion
      try {
        const oldChunks = await svc.entities.CorpusChunk.filter({ source: 'book' });
        console.log(`[academyPdfIngest] Deleting ${oldChunks.length} old corpus chunks…`);
        for (const oc of oldChunks) {
          try { await svc.entities.CorpusChunk.delete(oc.id); } catch (_) {}
        }
      } catch (_) {}

      // Build chunks
      const chunks = [];
      let chunkIndex = 0;
      for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
        const chunkText = fullText.slice(i, i + CHUNK_SIZE).trim();
        if (chunkText.length < 20) continue;
        chunks.push({ chunkIndex, chunkText });
        chunkIndex++;
      }
      console.log(`[academyPdfIngest] Created ${chunks.length} chunks, generating summaries in batches of ${SUMMARY_BATCH}…`);

      // Generate summaries in batches
      for (let i = 0; i < chunks.length; i += SUMMARY_BATCH) {
        const batch = chunks.slice(i, i + SUMMARY_BATCH);
        const summaries = await Promise.all(
          batch.map(async (c) => {
            try {
              const msg = await anthropic.messages.create({
                model: SUMMARY_MODEL,
                max_tokens: 60,
                system:
                  'You index an internal corpus. Reply with ONE original line (max 20 words) stating what the passage covers. ' +
                  'Your own words only — never copy or quote. No preamble, no quotes, just the line.',
                messages: [{ role: 'user', content: c.chunkText.slice(0, 1200) }],
              });
              return msg.content[0].text.trim();
            } catch (_) {
              return c.chunkText.slice(0, 100);
            }
          })
        );

        for (let j = 0; j < batch.length; j++) {
          try {
            await svc.entities.CorpusChunk.create({
              source: 'book',
              principle_number: 0,
              chunk_index: batch[j].chunkIndex,
              chunk_text: batch[j].chunkText,
              summary: summaries[j],
              token_count: Math.ceil(batch[j].chunkText.length / 4),
              line_start: i + j * CHUNK_SIZE,
              line_end: i + j * CHUNK_SIZE + batch[j].chunkText.length,
            });
            corpusCreated++;
          } catch (err) {
            console.error(`[academyPdfIngest] chunk ${batch[j].chunkIndex} error:`, err?.message);
          }
        }
        console.log(`[academyPdfIngest] Summarized ${Math.min(i + SUMMARY_BATCH, chunks.length)}/${chunks.length} chunks`);
      }
    }

    console.log(`[academyPdfIngest] DONE: ${principleResults.length} principles, ${corpusCreated} corpus chunks`);

    return Response.json({
      success: true,
      principles_extracted: principles.length,
      principle_results: principleResults,
      corpus_chunks_created: corpusCreated,
      full_text_length: fullText.length,
    });
  } catch (error) {
    console.error('[academyPdfIngest] error:', error);
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: 500 });
  }
});