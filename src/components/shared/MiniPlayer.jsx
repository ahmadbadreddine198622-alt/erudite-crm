import React from 'react';
import { X, Pause, Play, RotateCcw, Loader2 } from 'lucide-react';
import { useReadAloud } from '@/lib/ReadAloudContext';
import KaraokeText from './KaraokeText';

/**
 * MiniPlayer — floating bottom bar that persists while audio is playing.
 * Shows the current track title, progress, and pause/stop controls.
 * Rendered globally in AppLayout so it follows the user across page tabs.
 */
export default function MiniPlayer() {
  const { isPlaying, isPaused, isLoading, currentTrack, currentPara, audioProgress, pause, resume, stop } = useReadAloud();

  if (!isPlaying || !currentTrack) return null;

  const total = currentTrack.totalParas || currentTrack.paragraphs?.length || 0;
  const progress = total > 0 ? ((currentPara + 1) / total) * 100 : 0;
  const preview = currentTrack.paragraphs?.[currentPara] || '';

  return (
    <div
      className="fixed left-0 right-0 z-[10001] safe-area-bottom pb-[76px] md:pb-2 px-2"
      style={{
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 640,
          background: 'rgba(10,14,26,0.92)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(212,175,55,0.28)',
          borderTopColor: 'rgba(212,175,55,0.45)',
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(212,175,55,0.08)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Play / Pause */}
        <button
          onClick={() => (isPaused ? resume() : pause())}
          aria-label={isPaused ? 'Resume' : 'Pause'}
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
            border: '1px solid hsl(38 92% 50% / 0.5)',
            color: '#1a1205',
            cursor: 'pointer',
          }}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : isPaused ? <Play size={18} style={{ fill: 'currentColor' }} /> : <Pause size={18} style={{ fill: 'currentColor' }} />}
        </button>

        {/* Track info + progress */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#d4af37',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1,
              }}
            >
              {currentTrack.title}
            </span>
            {total > 0 && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                {currentPara + 1}/{total}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 3,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                borderRadius: 99,
                background: 'linear-gradient(90deg, hsl(38 92% 50%), hsl(38 92% 58%))',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {preview && (
            <KaraokeText
              text={preview.length > 140 ? preview.slice(0, 140) + '…' : preview}
              progress={audioProgress}
              style={{
                display: 'block',
                fontSize: 11,
                color: 'rgba(255,255,255,0.55)',
                marginTop: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            />
          )}
        </div>

        {/* Stop */}
        <button
          onClick={stop}
          aria-label="Stop"
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}