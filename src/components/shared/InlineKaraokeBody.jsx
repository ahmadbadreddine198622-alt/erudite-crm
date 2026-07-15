// InlineKaraokeBody — renders text with prominent word-by-word karaoke
// highlighting that follows the global voice engine while this track is
// active. When idle, renders the plain text (no overhead).
//
// Unlike HighlightedText (which only tints the current word), this emphasizes
// the ACTIVE paragraph with a gold left-border + tinted well and dims the
// surrounding paragraphs — the same feel as the global KaraokeReader panel,
// but inline inside the card body.
//
// The `title` must match the title passed to the nearby ReadAloudButton —
// the trackId is computed identically (`title::text.slice(0,80)`).
//
// Props:
//   text    — full text content (may contain multiple paragraphs)
//   title   — same title string passed to the ReadAloudButton
//   style   — optional inline style for the wrapper
//   activeColor — optional highlight color (defaults to brand gold #d4af37)
import React, { useMemo } from 'react';
import KaraokeText from './KaraokeText';
import { useReadAloud } from '@/lib/ReadAloudContext';

export default function InlineKaraokeBody({ text, title, style, activeColor }) {
  const { currentTrack, currentPara, audioProgress, isPlaying } = useReadAloud();

  const paragraphs = useMemo(() => {
    if (!text) return [];
    return String(text)
      .split(/\n\n+|\r\n\r\n+/)
      .flatMap((p) => p.split(/\n/))
      .map((p) => p.trim())
      .filter(Boolean);
  }, [text]);

  const trackId = useMemo(
    () => `${title}::${(text || '').slice(0, 80)}`,
    [title, text],
  );
  const isActive = isPlaying && currentTrack?.id === trackId && paragraphs.length > 0;

  if (!isActive) {
    return (
      <span style={style}>{text}</span>
    );
  }

  const gold = activeColor || '#d4af37';

  return (
    <div style={style}>
      {paragraphs.map((p, idx) => {
        const isCurrent = idx === currentPara;
        if (isCurrent) {
          return (
            <div
              key={idx}
              style={{
                background: 'rgba(212,175,55,0.07)',
                borderLeft: `2px solid ${gold}99`,
                borderRadius: '4px',
                padding: '3px 10px',
                marginBottom: 5,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.96)',
              }}
            >
              <KaraokeText text={p} progress={audioProgress} color={gold} />
            </div>
          );
        }
        return (
          <p
            key={idx}
            style={{
              margin: '0 0 5px',
              padding: '0 10px',
              fontSize: 12,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.32)',
            }}
          >
            {p}
          </p>
        );
      })}
    </div>
  );
}