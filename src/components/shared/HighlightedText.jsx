import React, { useMemo } from 'react';
import { useReadAloud } from '@/lib/ReadAloudContext';
import KaraokeText from './KaraokeText';

/**
 * HighlightedText — inline text that highlights word-by-word while the matching
 * TTS track is playing. Drop-in replacement for a plain text `<span>`.
 *
 * The `title` prop must match the title passed to the nearby `ReadAloudButton` —
 * the trackId is computed the same way (`title::text.slice(0,80)`) so the context
 * can determine if this text block is the one currently being spoken.
 *
 * When not the active track, renders as plain text with no overhead.
 *
 * Props:
 *   text     — full text content (may contain multiple paragraphs)
 *   title    — same title string passed to the ReadAloudButton
 *   style    — optional inline style
 *   className — optional className
 */
export default function HighlightedText({ text, title, style, className }) {
  const { currentTrack, currentPara, audioProgress, isPlaying } = useReadAloud();

  const trackId = useMemo(
    () => `${title}::${(text || '').slice(0, 80)}`,
    [title, text]
  );
  const isCurrent = isPlaying && currentTrack?.id === trackId;

  // Split into paragraphs the same way ReadAloudButton does.
  const paragraphs = useMemo(() => {
    if (!text) return [];
    return String(text)
      .split(/\n\n+|\r\n\r\n+/)
      .flatMap((p) => p.split(/\n/))
      .map((p) => p.trim())
      .filter(Boolean);
  }, [text]);

  if (!isCurrent || !paragraphs.length) {
    return (
      <span style={style} className={className}>
        {text}
      </span>
    );
  }

  return (
    <span style={style} className={className}>
      {paragraphs.map((para, pIdx) => {
        const isActivePara = pIdx === currentPara;
        return (
          <span key={pIdx}>
            {isActivePara ? (
              <KaraokeText text={para} progress={audioProgress} />
            ) : (
              para
            )}
            {pIdx < paragraphs.length - 1 ? '\n' : ''}
          </span>
        );
      })}
    </span>
  );
}