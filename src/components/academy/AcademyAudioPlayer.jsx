import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Gauge, ChevronUp, ChevronDown } from 'lucide-react';
import { useReadAloud } from '@/lib/ReadAloudContext';
import { GOLD, GOLD_LITE, card, goldStrip, serif, label } from '@/lib/academyStyles';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/**
 * AcademyAudioPlayer — full-featured audio player for Academy lessons.
 *
 * Sits at the top of a lesson. Features:
 *   - Play / Pause
 *   - Skip back 15 seconds
 *   - Playback speed (0.75x / 1x / 1.25x / 1.5x / 2x)
 *   - Progress bar (paragraph X of Y)
 *   - Current paragraph highlighting (reading pane)
 *   - Resume position per user per lesson
 *
 * Props:
 *   principle — the TrainingPrinciple object
 *   lessonId  — unique key for saving/restoring position
 */
export default function AcademyAudioPlayer({ principle, lessonId }) {
  const {
    isPlaying, isPaused, currentTrack, currentPara, rate, autoPlay,
    play, pause, resume, stop, skipBack15, setRate, getPosition,
  } = useReadAloud();

  const [showReadingPane, setShowReadingPane] = useState(true);
  const readingRef = useRef(null);

  // Extract paragraphs from the principle in logical reading order
  const paragraphs = useMemo(() => {
    if (!principle) return [];
    const paras = [];
    if (principle.name) paras.push(`${principle.name}.`);
    if (principle.tagline) paras.push(principle.tagline);
    if (principle.essence) paras.push(`Essence. ${principle.essence}`);
    if (principle.erudite_lesson) {
      String(principle.erudite_lesson).split('\n').filter(Boolean).forEach(p => paras.push(p.trim()));
    }
    if (principle.reading_assignment) paras.push(`Reading assignment. ${principle.reading_assignment}`);
    if (principle.daily_drills?.length) {
      paras.push('Daily drills.');
      principle.daily_drills.forEach((d, i) => paras.push(`${i + 1}. ${d}`));
    }
    if (principle.reflection_prompt) paras.push(`Reflection prompt. ${principle.reflection_prompt}`);
    return paras;
  }, [principle]);

  const trackId = lessonId || `academy-lesson-${principle?.id || principle?.week_number || 'unknown'}`;
  const isCurrent = currentTrack?.id === trackId;
  const isActive = isCurrent && isPlaying;
  const showPause = isCurrent && isPlaying && !isPaused;

  const savedPos = getPosition(trackId);

  // Auto-play on mount if setting is on
  useEffect(() => {
    if (autoPlay && principle && paragraphs.length && !isPlaying) {
      play(paragraphs, `Week ${principle.week_number}: ${principle.name}`, { id: trackId, startPara: savedPos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, principle?.id]);

  // Scroll reading pane to current paragraph
  useEffect(() => {
    if (isActive && readingRef.current) {
      const el = readingRef.current.querySelector(`[data-para-idx="${currentPara}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentPara, isActive]);

  // Stop audio when component unmounts
  useEffect(() => () => { if (isCurrent) stop(); }, []);

  const handlePlayPause = () => {
    if (isCurrent) {
      if (isPaused) resume();
      else pause();
    } else {
      play(paragraphs, `Week ${principle.week_number}: ${principle.name}`, { id: trackId, startPara: savedPos });
    }
  };

  const total = paragraphs.length;
  const progress = isActive && total > 0 ? ((currentPara + 1) / total) * 100 : 0;

  if (!total) return null;

  return (
    <div style={{ ...card, borderColor: isActive ? 'rgba(212,175,55,0.35)' : 'rgba(212,175,55,0.12)', marginBottom: 14 }}>
      {/* Player bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Play / Pause */}
        <button
          onClick={handlePlayPause}
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
            border: '1px solid hsl(38 92% 50% / 0.5)',
            color: '#1a1205',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(212,175,55,0.25)',
          }}
        >
          {showPause
            ? <Pause size={20} style={{ fill: 'currentColor' }} />
            : <Play size={20} style={{ fill: 'currentColor', marginLeft: 2 }} />}
        </button>

        {/* Title + progress */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...label, color: GOLD, fontSize: 9 }}>Listen to this lesson</span>
            {savedPos > 0 && !isActive && (
              <span style={{ fontSize: 9, color: 'rgba(212,175,55,0.5)', fontStyle: 'italic' }}>
                · resume from ¶{savedPos + 1}
              </span>
            )}
          </div>
          <p style={{ ...serif, fontSize: 14, color: GOLD_LITE, margin: '2px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Week {principle.week_number}: {principle.name}
          </p>
          {/* Progress bar */}
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              borderRadius: 99,
              background: 'linear-gradient(90deg, hsl(38 92% 50%), hsl(38 92% 60%))',
              transition: 'width 0.3s ease',
            }} />
          </div>
          {isActive && (
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
              Paragraph {currentPara + 1} of {total}
            </p>
          )}
        </div>

        {/* Skip back 15s */}
        <button
          onClick={skipBack15}
          disabled={!isActive}
          title="Skip back 15s"
          style={{
            flexShrink: 0,
            width: 34, height: 34, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: isActive ? GOLD : 'rgba(255,255,255,0.2)',
            cursor: isActive ? 'pointer' : 'default',
          }}
        >
          <RotateCcw size={15} />
        </button>

        {/* Speed selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Gauge size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
          <select
            value={rate}
            onChange={e => setRate(parseFloat(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 7,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 6px',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            {SPEEDS.map(s => <option key={s} value={s} style={{ background: '#0a0e1a' }}>{s}x</option>)}
          </select>
        </div>

        {/* Reading pane toggle */}
        <button
          onClick={() => setShowReadingPane(s => !s)}
          title={showReadingPane ? 'Hide reading pane' : 'Show reading pane'}
          style={{
            flexShrink: 0,
            width: 28, height: 28, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
          }}
        >
          {showReadingPane ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Reading pane — follows along with highlighted paragraph */}
      {showReadingPane && (
        <div ref={readingRef} style={{
          marginTop: 12,
          maxHeight: 280,
          overflowY: 'auto',
          padding: '4px 8px 4px 4px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {paragraphs.map((para, i) => {
            const isCurrent = isActive && i === currentPara;
            const isPast = isActive && i < currentPara;
            return (
              <p
                key={i}
                data-para-idx={i}
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  padding: '6px 10px',
                  borderRadius: 7,
                  marginBottom: 4,
                  transition: 'all 0.2s ease',
                  color: isCurrent
                    ? 'rgba(255,255,255,0.95)'
                    : isPast
                      ? 'rgba(255,255,255,0.3)'
                      : 'rgba(255,255,255,0.55)',
                  background: isCurrent ? 'rgba(212,175,55,0.1)' : 'transparent',
                  borderLeft: isCurrent ? '3px solid #d4af37' : '3px solid transparent',
                  fontWeight: isCurrent ? 500 : 400,
                }}
              >
                {para}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}