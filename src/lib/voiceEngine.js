/**
 * voiceEngine — premium text-to-speech engine powered by Base44 GenerateSpeech.
 *
 * ENGINE: Base44 GenerateSpeech integration ("storm" voice)
 *   - Produces natural, human-quality MP3 audio — a deep, authoritative leader tone.
 *   - No browser speechSynthesis dependency (eliminates robotic sound).
 *   - Generated URLs are cached so replays are instant and free.
 *
 * Exported interface (consumed by ReadAloudContext):
 *   speak(paragraphs, opts)    — start speaking an array of paragraph strings
 *   pause() / resume() / stop()
 *   skipBack15()               — jump back ~15 seconds
 *   seekParagraph(idx)         — jump to a specific paragraph
 *   updateRate(r) / updateVoice(v)
 *   getVoices()                — return available voices (single premium voice)
 *   on(event, cb) / off(event, cb)
 *   Events: 'paragraph' (idx), 'end', 'pause', 'resume', 'stop', 'error', 'loading'
 */

import { base44 } from '@/api/base44Client';

const PREMIUM_VOICE = {
  name: 'Erudite Leader (Storm)',
  voiceURI: 'storm',
  lang: 'en',
  default: true,
};

const listeners = {};
let paragraphs = [];
let currentPara = 0;
let rate = 1;
let paused = false;
let speaking = false;
let speakToken = 0; // increments on every new speak/stop — invalidates stale callbacks

// Single shared Audio element
let audioEl = null;
// Cache: text → generated MP3 URL (survives across tracks, avoids re-generation)
const urlCache = new Map();

// requestAnimationFrame loop for smooth (60fps) progress polling —
// the native `timeupdate` event fires only ~4×/sec, which makes word-by-word
// highlighting appear frozen or jumpy.
let rafId = null;
function startProgressLoop(token) {
  cancelProgressLoop();
  const tick = () => {
    if (token !== speakToken) return; // stale
    const audio = getAudio();
    if (!audio.src || audio.paused) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    let dur = audio.duration;
    if (!isFinite(dur) || dur <= 0) {
      // Duration unknown until metadata loads — estimate from buffered range
      if (audio.buffered.length > 0) {
        dur = audio.buffered.end(audio.buffered.length - 1);
      }
    }
    const prog = dur > 0 ? Math.min(1, audio.currentTime / dur) : 0;
    emit('timeupdate', prog);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}
function cancelProgressLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function on(event, cb) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb);
}
function off(event, cb) {
  if (!listeners[event]) return;
  listeners[event] = (listeners[event] || []).filter(f => f !== cb);
}
function emit(event, data) {
  (listeners[event] || []).forEach(cb => cb(data));
}

function isSupported() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function getVoices() {
  return [PREMIUM_VOICE];
}

function getAudio() {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.crossOrigin = 'anonymous';
  }
  return audioEl;
}

/**
 * Generate (or fetch from cache) an MP3 URL for a paragraph of text.
 */
async function synthesize(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (urlCache.has(trimmed)) {
    return urlCache.get(trimmed);
  }

  const res = await base44.integrations.Core.GenerateSpeech({
    text: trimmed.slice(0, 5000),
    voice: 'storm',
  });
  const url = res?.url || res?.data?.url;
  if (!url) throw new Error('No audio URL returned from GenerateSpeech');

  urlCache.set(trimmed, url);
  return url;
}

/**
 * Generate audio for paragraph idx and play it.
 * Handles caching, loading state, and sequential playback.
 */
async function playParagraph(idx) {
  if (idx >= paragraphs.length || idx < 0) {
    speaking = false;
    paused = false;
    emit('end');
    return;
  }

  const token = ++speakToken;
  currentPara = idx;
  speaking = true;
  paused = false;
  emit('paragraph', idx);
  emit('loading', true);

  const audio = getAudio();
  audio.pause();
  audio.playbackRate = rate;

  try {
    const url = await synthesize(paragraphs[idx]);

    // Stale check — user may have stopped or switched tracks during generation
    if (token !== speakToken) return;

    emit('loading', false);

    if (!url) {
      // Empty paragraph — skip to next
      playParagraph(idx + 1);
      return;
    }

    audio.src = url;
    audio.onended = () => {
      if (token !== speakToken) return;
      cancelProgressLoop();
      playParagraph(idx + 1);
    };
    audio.onerror = (e) => {
      if (token !== speakToken) return;
      cancelProgressLoop();
      emit('error', e);
      speaking = false;
      paused = false;
    };

    await audio.play();
    startProgressLoop(token); // 60fps progress for smooth word-by-word highlighting
  } catch (e) {
    if (token !== speakToken) return;
    emit('loading', false);
    emit('error', e);
    speaking = false;
    paused = false;
  }
}

function speak(paras, opts = {}) {
  stop();
  paragraphs = paras.filter(Boolean);
  if (!paragraphs.length) return;
  rate = opts.rate || rate;
  const start = opts.startPara || 0;
  playParagraph(start);
}

function pause() {
  if (!speaking || paused) return;
  const audio = getAudio();
  audio.pause();
  paused = true;
  cancelProgressLoop();
  emit('pause');
}

function resume() {
  if (!speaking || !paused) return;
  const audio = getAudio();
  audio.play().catch(() => {});
  paused = false;
  startProgressLoop(speakToken);
  emit('resume');
}

function stop() {
  speakToken++;
  cancelProgressLoop();
  const audio = getAudio();
  audio.pause();
  audio.removeAttribute('src');
  speaking = false;
  paused = false;
  emit('stop');
}

function skipBack15() {
  if (!speaking) return;
  const audio = getAudio();
  const newTime = Math.max(0, audio.currentTime - 15);
  audio.currentTime = newTime;
}

function seekParagraph(idx) {
  if (idx < 0 || idx >= paragraphs.length) return;
  playParagraph(idx);
}

function updateRate(r) {
  rate = r;
  const audio = getAudio();
  audio.playbackRate = r;
}

function updateVoice(v) {
  // Single premium voice — no-op. Kept for interface compatibility.
}

function getState() {
  return { speaking, paused, currentPara, totalParas: paragraphs.length };
}

export const voiceEngine = {
  isSupported,
  on, off, emit,
  getVoices,
  speak, pause, resume, stop,
  skipBack15, seekParagraph,
  updateRate, updateVoice,
  getState,
};