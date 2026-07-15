/**
 * Notification sound utility — uses the Web Audio API to generate a pleasant
 * two-tone chime that works even when the browser tab is in the background.
 *
 * Browser autoplay policy requires a user interaction before AudioContext
 * can play. We unlock on the first click/touch/keydown and keep it ready.
 * Also uses the browser Notification API (which triggers OS-level sounds)
 * as a secondary channel to "force" the computer to make sound.
 */

let audioCtx = null;
let unlocked = false;

function ensureContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      return null;
    }
  }
  return audioCtx;
}

/** Unlock audio on first user interaction (call once at app startup). */
export function unlockNotificationSound() {
  if (unlocked) return;
  const ctx = ensureContext();
  if (!ctx) return;

  const unlock = () => {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    unlocked = true;
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

/**
 * Play a two-tone notification chime via Web Audio API.
 * Loud enough to be heard even on low system volume.
 */
export function playNotificationSound() {
  const ctx = ensureContext();
  if (!ctx) return;

  // Resume if suspended (e.g. after backgrounding)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // Master gain — loud but not clipping
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  // Two-tone chime: E6 (1318.5 Hz) then G6 (1568.0 Hz)
  const tones = [
    { freq: 1318.51, start: 0,    dur: 0.15 },
    { freq: 1568.00, start: 0.12, dur: 0.22 },
  ];

  tones.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    // Envelope: quick attack, smooth decay
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.5, now + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

    osc.connect(gain);
    gain.connect(master);

    osc.start(now + start);
    osc.stop(now + start + dur + 0.05);
  });

  // Also fire a browser notification (triggers OS-level sound on most systems)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('Erudite CRM', {
        body: 'New notification — check your inbox',
        silent: false,
        tag: 'erudite-notification',
      });
      setTimeout(() => n.close(), 4000);
    } catch (_) {}
  }
}

/** Request browser notification permission (triggers OS sound). */
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}