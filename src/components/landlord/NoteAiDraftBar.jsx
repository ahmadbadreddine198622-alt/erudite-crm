// NoteAiDraftBar — the AI-draft control shown above the note composer in the Landlord
// Detail Notes tab. Offers two ON-DEMAND sources (Call summary, Conversation summary)
// generated fresh each click via the draftLandlordNote backend function, plus the three
// landlord-level static sources (Summary / Coaching / Next Action) that come from Analyse.
//
// Props:
//   landlord        — the current landlord record (for static AI fields + id)
//   noteAiSource     — currently active source key (string) or null
//   noteGenerating   — 'call' | 'conversation' | null (on-demand generation in progress)
//   onPick(text,key) — load a static draft into the composer
//   onGenerate(src)  — kick off on-demand generation ('call' | 'conversation')
//   onClear()        — clear the draft
export default function NoteAiDraftBar({ landlord, noteAiSource, noteGenerating, onPick, onGenerate, onClear }) {
  const str = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : '';
  const nba = (landlord?.aiNextBestAction && typeof landlord.aiNextBestAction === 'object') ? landlord.aiNextBestAction : null;
  const nextActionText = nba ? (str(nba.reasoning) || str(nba.action)) : '';

  const asyncSources = [
    { key: 'call_summary', label: 'Call', source: 'call' },
    { key: 'conversation_summary', label: 'Conversation', source: 'conversation' },
  ];
  const staticSources = [
    { key: 'ai_rolling_summary', label: 'Summary', text: str(landlord?.aiRollingSummary), emptyMsg: 'No summary yet — run Analyse' },
    { key: 'ai_coaching_for_agent', label: 'Coaching', text: str(landlord?.aiCoaching), emptyMsg: 'No coaching yet — run Analyse' },
    { key: 'ai_next_best_action', label: 'Next Action', text: nextActionText, emptyMsg: 'No next action yet — run Analyse' },
  ];

  const noneAvailable = staticSources.every((s) => !s.text);

  const pill = (active, available, onClick, label, title, extra) => (
    <button
      key={extra.key}
      onClick={available ? onClick : undefined}
      disabled={!available}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 7,
        fontSize: 10, fontWeight: 600, fontFamily: "'Inter',sans-serif",
        cursor: available ? 'pointer' : 'not-allowed',
        opacity: available ? 1 : 0.4,
        background: active ? 'rgba(139,92,246,0.22)' : 'rgba(139,92,246,0.06)',
        color: active ? '#ddd6fe' : '#c4b5fd',
        border: `1px solid ${active ? 'rgba(139,92,246,0.55)' : 'rgba(139,92,246,0.25)'}`,
      }}
    >
      {extra.loading && <span style={{ width: 9, height: 9, border: '1.5px solid #c4b5fd', borderTopColor: 'transparent', borderRadius: '50%', animation: 'nad-spin 0.7s linear infinite', display: 'inline-block' }} />}
      {label}
      {!available && extra.placeholder && <span style={{ fontSize: 8.5, fontWeight: 600, opacity: 0.85 }}>· Analyse</span>}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
      <style>{`@keyframes nad-spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#c4b5fd' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
        AI draft
      </span>

      {asyncSources.map((src) => {
        const active = noteAiSource === src.key;
        const loading = noteGenerating === src.source;
        return pill(active, !noteGenerating, () => onGenerate(src.source), src.label,
          loading ? 'Generating…' : `Draft a fresh note from the latest ${src.label.toLowerCase()}`,
          { key: src.key, loading, placeholder: false });
      })}

      {staticSources.map((src) => {
        const available = !!src.text;
        const active = noteAiSource === src.key;
        return pill(active, available, () => onPick(src.text, src.key), src.label,
          available ? `Draft from ${src.label}` : src.emptyMsg,
          { key: src.key, loading: false, placeholder: true });
      })}

      {noteAiSource && (
        <button onClick={onClear} title="Clear AI draft — write from scratch"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 7px', borderRadius: 7, fontSize: 9.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif", background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}>✕ Clear</button>
      )}
      {noteAiSource && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>AI draft</span>}
      {!noteAiSource && !noteGenerating && noneAvailable && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Run Analyse</span>}
    </div>
  );
}