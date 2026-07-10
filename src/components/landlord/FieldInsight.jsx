import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

// FieldInsight — renders a single-line AI "smart note" beneath a qualification
// field. Shows a tiny shimmer while the insight is loading, the insight text once
// ready, and nothing when the field is empty.
//
// Props:
//   insight  (string|null) — the AI insight for this field, or null
//   loading  (boolean)     — whether insights are currently being fetched
//   hasValue (boolean)     — whether the parent field has a value (controls visibility)
//   fieldKey (string)      — used as React key + title
export default function FieldInsight({ insight, loading, hasValue, fieldKey }) {
  if (!hasValue) return null;
  // Field answered but no insight yet (and not loading) → nothing to show.
  if (!insight && !loading) return null;

  return (
    <div
      key={fieldKey}
      className="mt-1 flex items-start gap-1.5"
      style={{ minHeight: 16 }}
      title="AI smart note"
    >
      {loading && !insight ? (
        <>
          <Loader2 className="w-2.5 h-2.5 mt-0.5 shrink-0 animate-spin" style={{ color: 'rgba(96,165,250,0.6)' }} />
          <span
            className="text-[9.5px] italic leading-snug"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            AI reading this answer…
          </span>
        </>
      ) : (
        <>
          <Sparkles className="w-2.5 h-2.5 mt-0.5 shrink-0" style={{ color: 'rgba(96,165,250,0.6)' }} />
          <span
            className="text-[9.5px] leading-snug"
            style={{ color: 'rgba(96,165,250,0.72)' }}
          >
            {insight}
          </span>
        </>
      )}
    </div>
  );
}