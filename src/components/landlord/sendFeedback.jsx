// Shared "message sent" feedback for the LandlordDetail composer — a short Web Audio
// confirmation sound + a brief colored flash overlay. Mirrors the iMessage/Email composers
// so every channel (incl. Telegram) gives the same multi-sensory confirmation.
import React from 'react';

// Play a short "whoosh / sent" sound via the Web Audio API — no asset file needed.
export function playSentSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
    const ping = ctx.createOscillator();
    const pgain = ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1320, now + 0.16);
    pgain.gain.setValueAtTime(0.0001, now + 0.16);
    pgain.gain.exponentialRampToValueAtTime(0.1, now + 0.2);
    pgain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    ping.connect(pgain).connect(ctx.destination);
    ping.start(now + 0.16);
    ping.stop(now + 0.52);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch (_) { /* sound is best-effort */ }
}

// Brief celebratory flash overlay shown over the composer right after a successful send.
// `color` is the accent (e.g. Telegram blue '#29b6f6'); `glyph` is the little send icon.
export function SendFlash({ color = '#29b6f6', label = 'Sent!', glyph = '➤' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: `linear-gradient(180deg, ${color}3d, ${color}14)`, backdropFilter: 'blur(3px)', borderRadius: 12, animation: 'sf-flash-out 0.4s ease forwards 1.3s' }}>
      <style>{`
        @keyframes sf-flash-in { 0% { opacity:0; transform:scale(0.6); } 55% { opacity:1; transform:scale(1.08); } 70% { transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }
        @keyframes sf-flash-out { to { opacity:0; } }
        @keyframes sf-plane { 0% { transform:translate(-6px,4px) rotate(-8deg); opacity:0; } 30% { opacity:1; } 100% { transform:translate(70px,-46px) rotate(12deg); opacity:0; } }
        @keyframes sf-ring { 0% { transform:scale(0.4); opacity:0.7; } 100% { transform:scale(2.4); opacity:0; } }
      `}</style>
      <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${color}b3`, animation: 'sf-ring 0.9s ease-out' }} />
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', animation: 'sf-flash-in 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>✓</div>
        <span style={{ position: 'absolute', fontSize: 20, animation: 'sf-plane 0.9s ease-out forwards' }}>{glyph}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', color, animation: 'sf-flash-in 0.5s ease' }}>{label}</span>
    </div>
  );
}