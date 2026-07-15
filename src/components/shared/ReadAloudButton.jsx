import React, { useMemo } from 'react';
import { AudioLines, Pause, Play, VolumeX, Loader2, Volume2 } from 'lucide-react';
import { useReadAloud } from '@/lib/ReadAloudContext';

/**
 * ReadAloudButton — prominent gold square TTS control (matches the Erudite
 * gold-audio design language). Click to read any text aloud through the
 * global voice engine (Base44 GenerateSpeech "storm" voice); click again to
 * pause/resume. A floating MiniPlayer persists across pages while playing.
 *
 * Props:
 *   text    — content to speak (string)
 *   title   — label shown in the mini-player (e.g. "WhatsApp · Ahmed")
 *   size    — button px (default 28)
 *   style   — extra inline styles for the wrapper
 *   disabled
 */
export default function ReadAloudButton({ text, title = 'CRM Content', size = 28, style, disabled }) {
  const { isPlaying, isPaused, isLoading, currentTrack, play, pause, resume, error } = useReadAloud();

  const paragraphs = useMemo(() => {
    if (!text) return [];
    return String(text)
      .split(/\n\n+|\r\n\r\n+/)
      .flatMap(p => p.split(/\n/))
      .map(p => p.trim())
      .filter(Boolean);
  }, [text]);

  const trackId = useMemo(() => `${title}::${(text || '').slice(0, 80)}`, [title, text]);
  const isCurrent = currentTrack?.id === trackId;

  // When ANY audio is playing on the tab, every ReadAloudButton reflects the
  // global play/pause state — so clicking any button pauses/resumes the audio.
  const showSpinner = isCurrent && isLoading;
  const showPause = isPlaying && !isPaused && !isLoading;
  const showResume = isPaused && !isLoading;

  const handleClick = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (disabled || !paragraphs.length) return;
    if (isPlaying && !isPaused) {
      // Audio is playing from any track — pause it
      pause();
    } else if (isPaused) {
      // Audio is paused — resume it
      resume();
    } else {
      // Nothing playing — start this track
      play(paragraphs, title, { id: trackId });
    }
  };

  const hasError = error && !isPlaying;
  const active = isPlaying && !hasError;

  const iconSize = Math.round(size * 0.5);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={hasError ? 'Audio unavailable' : showSpinner ? 'Generating audio…' : showPause ? 'Pause' : showResume ? 'Resume' : 'Listen'}
      aria-label="Listen to text"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: active
          ? 'linear-gradient(135deg, #eccd72, #d4af37)'
          : '#d4af37',
        border: 'none',
        color: '#1a1205',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
        transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: active
          ? '0 0 0 3px rgba(212,175,55,0.22), 0 2px 10px rgba(212,175,55,0.30)'
          : '0 1px 5px rgba(212,175,55,0.18)',
        ...style,
      }}
    >
      {hasError ? (
        <VolumeX size={iconSize} />
      ) : showSpinner ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : showPause ? (
        <Pause size={iconSize} style={{ fill: 'currentColor' }} strokeWidth={0} />
      ) : showResume ? (
        <Play size={iconSize} style={{ fill: 'currentColor' }} strokeWidth={0} />
      ) : (
        <Volume2 size={iconSize} strokeWidth={2.2} />
      )}
    </button>
  );
}