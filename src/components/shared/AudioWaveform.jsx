import React, { useEffect, useRef } from 'react';

/**
 * Advanced Animated Audio Waveform Visualizer
 * Inspired by modern motion design — dynamic, glowing bars with fluid motion
 */
export default function AudioWaveform({ 
  isActive = true, 
  barCount = 42, 
  height = 32,
  width = '100%',
  primaryColor = '#FFB81C',
  secondaryColor = '#F5E0A1',
  className = ''
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const phaseRef = useRef(0);
  const barsRef = useRef([]);

  // Initialize bar amplitudes
  useEffect(() => {
    barsRef.current = Array.from({ length: barCount }, (_, i) => ({
      base: 0.15 + Math.random() * 0.2,
      speed: 0.02 + Math.random() * 0.03,
      offset: (i / barCount) * Math.PI * 2,
    }));
  }, [barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let running = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      if (!running) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      if (!isActive) {
        // Draw static subtle line
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.strokeStyle = secondaryColor;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      phaseRef.current += 0.015;
      const phase = phaseRef.current;

      const barWidth = w / barCount;
      const centerY = h / 2;

      barsRef.current.forEach((bar, i) => {
        const x = i * barWidth + barWidth / 2;
        
        // Wave interference pattern for organic motion
        const wave1 = Math.sin(phase * bar.speed * 50 + bar.offset);
        const wave2 = Math.sin(phase * bar.speed * 30 - bar.offset * 0.5);
        const wave3 = Math.cos(phase * bar.speed * 20 + bar.offset * 0.3);
        
        const amplitude = bar.base + (wave1 + wave2 * 0.5 + wave3 * 0.3) * 0.4;
        const barHeight = Math.max(2, amplitude * h * 0.9);

        // Gradient from primary to secondary
        const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(0.5, primaryColor);
        gradient.addColorStop(1, secondaryColor);

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.6 + amplitude * 0.4;

        // Rounded bar caps
        ctx.beginPath();
        ctx.roundRect(x - barWidth * 0.35, centerY - barHeight / 2, barWidth * 0.7, barHeight, 2);
        ctx.fill();

        // Glow effect for taller bars
        if (amplitude > 0.6) {
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 8;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.roundRect(x - barWidth * 0.35, centerY - barHeight / 2, barWidth * 0.7, barHeight, 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Subtle connecting line underneath
      ctx.beginPath();
      ctx.moveTo(0, centerY + 8);
      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth + barWidth / 2;
        const bar = barsRef.current[i];
        const wave = Math.sin(phase * bar.speed * 50 + bar.offset);
        ctx.lineTo(x, centerY + 8 + wave * 2);
      }
      ctx.strokeStyle = secondaryColor;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, barCount, primaryColor, secondaryColor, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width,
        height: `${height}px`,
        display: 'block',
      }}
    />
  );
}