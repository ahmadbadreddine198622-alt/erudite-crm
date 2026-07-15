import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * DictationBar — thin live waveform strip that renders INSIDE the input bar area.
 *
 * Renders as a full-width strip positioned at the bottom edge of the input area
 * (absolute, bottom: 100% of the nearest positioned ancestor). Contains:
 *   • Thin animated gold waveform bars (driven by the mic AnalyserNode)
 *   • Interim transcription text (dimmed/italic until finalized)
 *   • A stop button at the right end
 *
 * Styled to look like an integral part of the input bar — not a floating popup.
 */
function Waveform({ analyser }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!analyser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.offsetWidth || 200;
    const cssH = 20;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = Math.max(12, Math.floor(cssW / 6));
    const gap = 2;
    const barWidth = Math.max(1, (cssW - gap * (barCount - 1)) / barCount);
    const step = Math.max(1, Math.floor(bufferLength / barCount));

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, cssW, cssH);

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] || 0;
        const normalized = val / 255;
        const minH = 2;
        const barHeight = Math.max(minH, normalized * cssH * 0.85);
        const x = i * (barWidth + gap);
        const y = (cssH - barHeight) / 2;
        const opacity = 0.3 + normalized * 0.7;
        ctx.fillStyle = `rgba(212, 175, 55, ${opacity})`;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 20, display: 'block' }}
    />
  );
}

export default function DictationBar({ analyser, onStop, interimText }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: 4,
        zIndex: 50,
        minWidth: 280,
        maxWidth: 400,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px 5px 12px',
        borderRadius: 8,
        background: 'rgba(13,27,42,0.96)',
        border: '1px solid rgba(212,175,55,0.28)',
        borderBottom: '1px solid rgba(212,175,55,0.12)',
        backdropFilter: 'blur(14px) saturate(180%)',
        WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <Waveform analyser={analyser} />

      {interimText && (
        <span
          style={{
            fontSize: 11,
            color: 'rgba(212,175,55,0.55)',
            fontStyle: 'italic',
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
            fontFamily: "'Inter',sans-serif",
          }}
        >
          {interimText}
        </span>
      )}

      <button
        onClick={onStop}
        title="Stop dictation"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 6,
          background: 'rgba(212,175,55,0.2)',
          border: '1px solid rgba(212,175,55,0.4)',
          color: '#d4af37',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}