import React from 'react';

/**
 * KaraokeText — renders text with the currently-spoken word highlighted.
 *
 * The TTS engine (GenerateSpeech) doesn't return word-level timestamps, so we
 * estimate the active word by distributing words evenly across the audio
 * duration. `progress` is a 0–1 float representing playback position within the
 * paragraph.
 *
 * Props:
 *   text     — the paragraph string to render
 *   progress — 0–1 float (audio currentTime / duration)
 *   style    — optional inline style for the wrapper span
 *   color    — optional highlight color (defaults to brand gold)
 */
const HIGHLIGHT_STYLE = {
  background: '#d4af37',
  borderRadius: '3px',
  boxShadow: '0 0 8px rgba(212,175,55,0.45)',
  color: '#ffffff',
  fontWeight: 600,
  padding: '0 2px',
  transition: 'background 0.12s ease, box-shadow 0.12s ease',
};

export default function KaraokeText({ text, progress = 0, style, color }) {
  if (!text) return null;

  // Split keeping whitespace tokens so spacing is preserved.
  const parts = String(text).split(/(\s+)/);
  const wordCount = parts.filter((p) => p.trim()).length;
  const activeIdx =
    progress > 0 && wordCount > 0
      ? Math.min(wordCount - 1, Math.floor(progress * wordCount))
      : -1;

  const highlight = color ? { ...HIGHLIGHT_STYLE, background: color, boxShadow: `0 0 8px ${color}80` } : HIGHLIGHT_STYLE;

  let wi = -1;
  return (
    <span style={style}>
      {parts.map((part, i) => {
        if (!part.trim()) return part;
        wi++;
        const isActive = wi === activeIdx;
        return (
          <span key={i} style={isActive ? highlight : null}>
            {part}
          </span>
        );
      })}
    </span>
  );
}