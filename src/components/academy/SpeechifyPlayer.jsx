import React, { useMemo } from 'react';
import ReadAloudButton from '@/components/shared/ReadAloudButton';

/**
 * SpeechifyPlayer — reusable TTS audio button.
 *
 * Delegates to the GLOBAL voice engine (ReadAloudContext → voiceEngine,
 * Base44 GenerateSpeech "storm" voice) and renders the prominent gold
 * square ReadAloudButton so every surface that uses <SpeechifyPlayer/>
 * gets the same consistent gold TTS control + floating MiniPlayer.
 *
 * Props:
 *   text       — the text to synthesize
 *   language   — optional ISO code (kept for interface compat, ignored)
 *   size       — legacy icon-size hint used to scale the gold button
 *   color      — ignored (gold square is always gold)
 *   title      — optional mini-player label
 *   style      — extra inline styles for the button
 */
export default function SpeechifyPlayer({ text, language, size = 14, color, title = 'CRM Content', style }) {
  // Legacy callers passed an icon size (11–14); map to a button size.
  const btnSize = Math.max(20, Math.round(size * 2.1));
  return (
    <ReadAloudButton
      text={text}
      title={title}
      size={btnSize}
      style={style}
    />
  );
}