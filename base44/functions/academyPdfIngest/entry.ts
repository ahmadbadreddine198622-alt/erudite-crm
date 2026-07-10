import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * academyPdfIngest — Admin-only PDF upload for THE 17 curriculum.
 *
 * Receives a file_url (uploaded PDF), sends it to Claude to extract all 17
 * structured principles as JSON, upserts TrainingPrinciple records by
 * week_number, and stores the full document text as CorpusChunk records
 * for the Mentor's semantic retrieval.
 *
 * POST { file_url }
 */

const MODEL = 'claude-sonnet-4-20250514';
const CHUNK_SIZE = 1200; // ~300 tokens per chunk

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

    console.log(`[academyPdfIngest] PDF fetched (${pdfBuf.byteLength} bytes), sending to Claude…`);

    // ── Claude extracts all 17 principles + full text ──
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system:
        'You are an expert curriculum architect for a 17-week real estate sales mastery program called "THE 17". ' +
        'You receive a PDF containing the full curriculum. Extract every weekly principle as structured JSON. ' +
        'Be thorough — capture the COMPLETE lesson text, ALL daily drills, and create 3-5 quiz questions per week. ' +
        'If the document does not contain all 17 weeks, extract as many as you can find and set missing weeks aside. ' +
        'Return ONLY valid JSON — no markdown, no fences, no commentary.',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: [
              'Extract all 17 weekly principles from this document as a single JSON object with this exact shape:',
              '{"principles": [',
              '  {"week_number": 1, "name": "...", "slug": "week-01-kebab-case-name", "tagline": "...",',
              '   "rank_title": "...", "directive_text": "...", "essence": "...",',
              '   "erudite_lesson": "full multi-paragraph text with \\n\\n between paragraphs",',
              '   "reading_assignment": "...", "daily_drills": ["drill 1", "drill 2"],',
              '   "reflection_prompt": "...",',
              '   "quiz_questions": [{"question": "...", "options": ["a","b","c","d"], "correct_index": 0}]}',
              '], "full_text": "the complete raw text of the entire document, preserving order"}',
              '',
              'Rules:',
              '- slug must be lowercase, URL-safe, like "week-01-the-burning-desire"',
              '- erudite_lesson must be the FULL lesson text, not a summary',
              '- daily_drills should have 3-7 items',
              '- quiz_questions should have 3-5 items per week',
              '- full_text should be as complete as possible — this powers the AI Mentor search',
            ].join('\n'),
          },
        ],
      }],
    });

    const raw = msg.content.find(b => b.type === 'text')?.text || '';
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const data = JSON.parse(jsonStr);

    const principles = Array.isArray(data.principles) ? data.principles : [];
    const fullText = data.full_text || '';

    console.log(`[academyPdfIngest] Extracted ${principles.length} principles, ${fullText.length} chars of text`);

    const svc = base44.asServiceRole;

    // ── Upsert TrainingPrinciple records ──
    const principleResults = [];
    for (const p of principles) {
      try {
        if (!p.week_number || !p.name) continue;
        // Derive slug if missing
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

    // ── Chunk and store corpus text ──
    let corpusCreated = 0;
    let corpusSkipped = 0;
    if (fullText.length > 100) {
      const source = `pdf_upload_${Date.now()}`;
      let chunkIndex = 0;
      for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
        const chunkText = fullText.slice(i, i + CHUNK_SIZE);
        try {
          const existing = await svc.entities.CorpusChunk.filter({ source, chunk_index: chunkIndex });
          if (existing[0]) {
            corpusSkipped++;
          } else {
            await svc.entities.CorpusChunk.create({
              source,
              principle_number: 0,
              chunk_index: chunkIndex,
              chunk_text: chunkText,
              token_count: Math.ceil(chunkText.length / 4),
              line_start: i,
              line_end: i + chunkText.length,
            });
            corpusCreated++;
          }
        } catch (_) {}
        chunkIndex++;
        if (chunkIndex >= 80) break; // safety cap
      }
    }

    console.log(`[academyPdfIngest] Done: ${principleResults.length} principles, ${corpusCreated} corpus chunks`);

    return Response.json({
      success: true,
      principles_extracted: principles.length,
      principle_results: principleResults,
      corpus_chunks_created: corpusCreated,
      corpus_chunks_skipped: corpusSkipped,
    });
  } catch (error) {
    console.error('[academyPdfIngest] error:', error);
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: 500 });
  }
});