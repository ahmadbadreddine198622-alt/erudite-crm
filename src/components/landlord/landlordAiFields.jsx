// Pure helpers extracted from LandlordDetailPage to keep that file under the size cap.
// These derive AI-related view fields from the raw Landlord record + score snapshots.

// V3 Phase 2 (REMEMBER): normalize ai_open_questions into [{question, why}], dropping empties.
export function deriveOpenQuestions(raw) {
  return Array.isArray(raw)
    ? raw
        .map((q) => (typeof q === 'string' ? { question: q, why: '' } : (q && typeof q === 'object' ? { question: String(q.question || '').trim(), why: String(q.why || '').trim() } : null)))
        .filter((q) => q && q.question)
    : [];
}

// Compact score trajectory from the append-only snapshot history (newest-first in).
// Needs ≥2 runs to show movement; each metric carries its recent series + last-run delta.
export function deriveScoreTrend(scoreSnapshots) {
  const snaps = Array.isArray(scoreSnapshots) ? scoreSnapshots : [];
  if (snaps.length < 2) return null;
  const chrono = [...snaps].reverse();
  const metric = (pick) => {
    const s = chrono.map(pick).filter((v) => typeof v === 'number' && isFinite(v));
    if (s.length < 2) return null;
    return { series: s.slice(-12), latest: s[s.length - 1], delta: Math.round((s[s.length - 1] - s[s.length - 2]) * 10) / 10 };
  };
  const trust = metric((x) => x.trust_score);
  const win = metric((x) => (typeof x.mandate_win_probability === 'number' ? x.mandate_win_probability * 100 : null));
  const urgency = metric((x) => x.urgency_score);
  if (!trust && !win && !urgency) return null;
  return { count: snaps.length, since: chrono[0].captured_at || null, lastAt: chrono[chrono.length - 1].captured_at || null, trust, win, urgency };
}