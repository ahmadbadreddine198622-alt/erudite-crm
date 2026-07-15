import React from 'react';
import { X, Pause, Play, Loader2 } from 'lucide-react';
import { useReadAloud } from '@/lib/ReadAloudContext';
import KaraokeText from './KaraokeText';

/**
 * KaraokeReader — full reading panel that appears while the global voice engine
 * is reading aloud. Shows the current paragraph in a subtle rounded container
 * with the active word highlighted following the audio, surrounding paragraphs
 * dimmed for context, plus pause/resume + stop and a loading spinner.
 *
 * Rendered globally in AppLayout so pressing any gold "speak" (ReadAloud) button
 * surfaces the word-by-word reading view across every page.
 */
export default function KaraokeReader() {
  const { isPlaying, isPaused, isLoading, currentTrack, currentPara, audioProgress, pause, resume, stop } = useReadAloud();

  if (!isPlaying || !currentTrack) return null;

  const paragraphs = currentTrack.paragraphs || [];
  const total = currentTrack.totalParas || paragraphs.length;
  const overallProgress = total > 0 ? ((currentPara + 1) / total) * 100 : 0;

  // One paragraph of context before + after the current one.
  const start = Math.max(0, currentPara - 1);
  const end = Math.min(paragraphs.length, currentPara + 2);
  const visible = paragraphs.slice(start, end);

  return (
    <div
      className="fixed left-0 right-0 z-[10001] safe-area-bottom pb-[76px] md:pb-3 px-2"
      style={{ pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 680,
          background: 'rgba(10,14,26,0.94)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(212,175,55,0.28)',
          borderTopColor: 'rgba(212,175,55,0.45)',
          borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 28px rgba(212,175,55,0.08)',
          padding: '12px 14px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        {/* Pause / Resume */}
        <button
          onClick={() => (isPaused ? resume() : pause())}
          aria-label={isPaused ? 'Resume' : 'Pause'}
          style={{
            flexShrink: 0,
            width: 42,
            height: 42,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
            border: '1px solid hsl(38 92% 50% / 0.5)',
            color: '#1a1205',
            cursor: 'pointer',
          }}
        >
          {isLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : isPaused ? (
            <Play size={20} style={{ fill: 'currentColor' }} />
          ) : (
            <Pause size={20} style={{ fill: 'currentColor' }} />
          )}
        </button>

        {/* Reading block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
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

          <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight:4 }}>
            {visible.map((p, i) => {
              const realIdx = start + i;
              const isCurrent = realIdx === currentPara;
              if (isCurrent) {
                return (
                  <div
                    key={realIdx}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(212,175,55,0.18)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      marginBottom: 6,
                      fontSize: 13.5,
                      lineHeight: 1.65,
                      color: 'rgba(255,255,255,0.62)',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <KaraokeText text={p} progress={audioProgress} />
                  </div>
                );
              }
              return (
                <p
                  key={realIdx}
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.22)',
                    margin: '0 0 6px',
                    padding: '0 10px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {p}
                </p>
              );
            })}
          </div>

          {/* Progress */}
          <div
            style={{
              height: 3,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              marginTop: 6,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${overallProgress}%`,
                borderRadius: 99,
                background: 'linear-gradient(90deg, hsl(38 92% 50%), hsl(38 92% 58%))',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
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