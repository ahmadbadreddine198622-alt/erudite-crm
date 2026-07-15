import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * academyPdfIngest — Admin-only PDF upload for THE 17 curriculum.
 *
 * Two-pass extraction:
 *   Pass 1: Structured principles (17 TrainingPrinciple records, upserted by week_number)
 *   Pass 2: Full-book text via multi-call page-range extraction → CorpusChunk records
 *
 * A single Claude call cannot output a full book (output token limit), so
 * Pass 2 loops through page ranges (~15 pages per call) until the model
 * reports no more pages or we hit the safety cap.
 *
 * POST { file_url, mode? }
 *   mode: 'full' (default) — principles + corpus
 *   mode: 'principles' — structured principles only
 *   mode: 'corpus' — full-text corpus chunks only (clears old chunks first)
 */

const PRINCIPLE_MODEL = 'claude-sonnet-4-20250514';
const TEXT_MODEL = 'claude-sonnet-4-20250514';
const CHUNK_SIZE = 1200;
const PAGES_PER_CALL = 15;
const MAX_TEXT_PASSES = 12;

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json(401, { error: 'Unauthorized' });
    if (user.role !== 'admin') return json(403, { error: 'Admin access required' });

    const body = await req.json();
    const { file_url, mode = 'full' } = body;
    if (!file_url) return json(400, { error: 'file_url is required' });

    // ── Fetch the PDF ──
    const pdfRes = await fetch(file_url);
    if (!pdfRes.ok) return json(500, { error: `Failed to fetch PDF: ${pdfRes.status}` });
    const pdfBuf = await pdfRes.arrayBuffer();
    const pdfBase64 = bufToBase64(pdfBuf);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const svc = base44.asServiceRole;

    console.log(`[academyPdfIngest] PDF fetched (${pdfBuf.byteLength} bytes), mode=${mode}`);

    const result = { success: true, mode, principle_results: [], corpus_chunks_created: 0, corpus_chunks_deleted: 0, text_passes: 0 };

    // ═══════════════════════════════════════
    // PASS 1: Structured principles
    // ═══════════════════════════════════════
    if (mode === 'full' || mode === 'principles') {
      console.log('[academyPdfIngest] Pass 1: extracting structured principles…');
      const msg = await anthropic.messages.create({
        model: PRINCIPLE_MODEL,
        max_tokens: 16000,
        system:
          'You are an expert curriculum architect for a 17-week real estate sales mastery program called "THE 17". ' +
          'You receive a PDF containing the full curriculum. Extract every weekly principle as structured JSON. ' +
          'Be thorough — capture the COMPLETE lesson text, ALL daily drills, and create 3-5 quiz questions per week. ' +
          'If the document does not contain all 17 weeks, extract as many as you can find. ' +
          'Return ONLY valid JSON — no markdown, no fences, no commentary.',
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            {
              type: 'text',
              text: [
                'Extract all 17 weekly principles from this document as a JSON object: {"principles": [...]}',
                'Each principle: {"week_number": 1, "name": "...", "slug": "week-01-kebab-case-name", "tagline": "...",',
                '"rank_title": "...", "directive_text": "...", "essence": "...",',
                '"erudite_lesson": "full multi-paragraph text with \\n\\n between paragraphs",',
                '"reading_assignment": "...", "daily_drills": ["drill 1", "drill 2"],',
                '"reflection_prompt": "...",',
                '"quiz_questions": [{"question": "...", "options": ["a","b","c","d"], "correct_index": 0}]}',
                '',
                'Rules: slug must be lowercase URL-safe like "week-01-the-burning-desire".',
                'erudite_lesson must be FULL lesson text. daily_drills 3-7 items. quiz_questions 3-5 per week.',
              ].join('\n'),
            },
          ],
        }],
      });

      const raw = msg.content.find(b => b.type === 'text')?.text || '';
      const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      let principles = [];
      try { principles = JSON.parse(jsonStr).principles || []; } catch (e) {
        console.error('[academyPdfIngest] principle JSON parse failed:', String(e).slice(0, 200));
      }

      for (const p of principles) {
        try {
          if (!p.week_number || !p.name) continue;
          if (!p.slug) {
            p.slug = `week-${String(p.week_number).padStart(2, '0')}-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
          }
          const existing = await svc.entities.TrainingPrinciple.filter({ week_number: p.week_number });
          if (existing[0]) {
            await svc.entities.TrainingPrinciple.update(existing[0].id, p);
            result.principle_results.push({ week: p.week_number, name: p.name, status: 'updated' });
          } else {
            await svc.entities.TrainingPrinciple.create(p);
            result.principle_results.push({ week: p.week_number, name: p.name, status: 'created' });
          }
        } catch (err) {
          result.principle_results.push({ week: p.week_number, status: 'error', error: String(err?.message || err).slice(0, 200) });
        }
      }
      console.log(`[academyPdfIngest] Pass 1 done: ${result.principle_results.length} principles processed`);
    }

    // ═══════════════════════════════════════
    // PASS 2: Full-text corpus via multi-call page-range extraction
    // ═══════════════════════════════════════
    if (mode === 'full' || mode === 'corpus') {
      console.log('[academyPdfIngest] Pass 2: extracting full text via page ranges…');

      // Clear old corpus chunks
      const oldChunks = await svc.entities.CorpusChunk.list('chunk_index', 2000);
      if (oldChunks.length > 0) {
        for (const c of oldChunks) {
          try { await svc.entities.CorpusChunk.delete(c.id); } catch (_) {}
        }
        result.corpus_chunks_deleted = oldChunks.length;
        console.log(`[academyPdfIngest] Cleared ${oldChunks.length} old corpus chunks`);
      }

      const source = `pdf_upload_${Date.now()}`;
      let chunkIndex = 0;
      let startPage = 1;

      for (let pass = 0; pass < MAX_TEXT_PASSES; pass++) {
        const endPage = startPage + PAGES_PER_CALL - 1;
        console.log(`[academyPdfIngest] Text pass ${pass + 1}: pages ${startPage}-${endPage}…`);

        const textMsg = await anthropic.messages.create({
          model: TEXT_MODEL,
          max_tokens: 8000,
          system:
            'You are a precise text extraction engine. You receive a PDF and a page range. ' +
            'Extract the EXACT text from those pages, preserving order and paragraph breaks. ' +
            'Do NOT summarize, do NOT add commentary, do NOT include page numbers or headers. ' +
            'If the document has fewer pages than the requested range, extract whatever remains and append "[END]" at the very end. ' +
            'If the requested pages are completely beyond the document, respond with only "[END]".',
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
              {
                type: 'text',
                text: `Extract the complete text from pages ${startPage} to ${endPage} of this document. Return only the raw text, with [END] appended if these are the last pages or beyond the document.`,
              },
            ],
          }],
        });

        const pageText = textMsg.content.find(b => b.type === 'text')?.text || '';
        const isEnd = pageText.trim() === '[END]' || pageText.includes('[END]');
        const cleanText = pageText.replace('[END]', '').trim();

        if (cleanText.length > 50) {
          // Chunk and store
          for (let i = 0; i < cleanText.length; i += CHUNK_SIZE) {
            const chunkText = cleanText.slice(i, i + CHUNK_SIZE);
            if (chunkText.trim().length < 20) continue;
            try {
              await svc.entities.CorpusChunk.create({
                source,
                principle_number: 0,
                chunk_index: chunkIndex,
                chunk_text: chunkText,
                token_count: Math.ceil(chunkText.length / 4),
                line_start: i,
                line_end: i + chunkText.length,
              });
              result.corpus_chunks_created++;
              chunkIndex++;
            } catch (e) {
              console.error(`[academyPdfIngest] chunk create error at index ${chunkIndex}:`, String(e).slice(0, 100));
            }
          }
          result.text_passes++;
        }

        if (isEnd) {
          console.log(`[academyPdfIngest] Reached end of document at pass ${pass + 1}`);
          break;
        }
        startPage = endPage + 1;
      }

      console.log(`[academyPdfIngest] Pass 2 done: ${result.corpus_chunks_created} corpus chunks from ${result.text_passes} passes`);
    }

    console.log(`[academyPdfIngest] Complete: ${result.principle_results.length} principles, ${result.corpus_chunks_created} corpus chunks`);
    return json(200, result);
  } catch (error) {
    console.error('[academyPdfIngest] error:', error);
    return json(500, { error: String(error?.message || error).slice(0, 500) });
  }
});