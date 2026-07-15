import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { voiceEngine } from '@/lib/voiceEngine';

const ReadAloudContext = createContext(null);

// ─── localStorage settings helpers ───
function loadSetting(key, def) {
  try {
    const v = localStorage.getItem(`erudite_tts_${key}`);
    if (v === null) return def;
    if (key === 'tts_rate') return parseFloat(v);
    if (key === 'tts_autoplay') return v === 'true';
    return v;
  } catch { return def; }
}
function saveSetting(key, val) {
  try { localStorage.setItem(`erudite_tts_${key}`, String(val)); } catch {}
}

export function ReadAloudProvider({ children }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null); // { id, title, paragraphs }
  const [currentPara, setCurrentPara] = useState(0);
  const [rate, setRateState] = useState(() => loadSetting('tts_rate', 1));
  const [voiceURI, setVoiceURIState] = useState(() => loadSetting('tts_voice', null));
  const [autoPlay, setAutoPlayState] = useState(() => loadSetting('tts_autoplay', false));
  const [voices, setVoices] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const location = useLocation();
  const firstRender = useRef(true);

  // ─── Load available voices ───
  useEffect(() => {
    const load = () => setVoices(voiceEngine.getVoices());
    load();
    const handler = () => load();
    voiceEngine.on('voiceschanged', handler);
    // Retry a few times — Chrome can be slow to populate voices
    [100, 500, 1500].forEach(ms => setTimeout(load, ms));
    return () => voiceEngine.off('voiceschanged', handler);
  }, []);

  // ─── Engine event listeners ───
  useEffect(() => {
    const onPara = (idx) => { setCurrentPara(idx); setAudioProgress(0); };
    const onEnd = () => { setIsPlaying(false); setIsPaused(false); };
    const onPause = () => setIsPaused(true);
    const onResume = () => setIsPaused(false);
    const onStop = () => { setIsPlaying(false); setIsPaused(false); setIsLoading(false); setCurrentTrack(null); setCurrentPara(0); setAudioProgress(0); };
    const onError = (e) => { setError(e); setIsPlaying(false); setIsLoading(false); setAudioProgress(0); };
    const onLoading = (v) => setIsLoading(v);
    const onTimeUpdate = (p) => setAudioProgress(p);

    voiceEngine.on('paragraph', onPara);
    voiceEngine.on('end', onEnd);
    voiceEngine.on('pause', onPause);
    voiceEngine.on('resume', onResume);
    voiceEngine.on('stop', onStop);
    voiceEngine.on('error', onError);
    voiceEngine.on('loading', onLoading);
    voiceEngine.on('timeupdate', onTimeUpdate);
    return () => {
      voiceEngine.off('paragraph', onPara);
      voiceEngine.off('end', onEnd);
      voiceEngine.off('pause', onPause);
      voiceEngine.off('resume', onResume);
      voiceEngine.off('stop', onStop);
      voiceEngine.off('error', onError);
      voiceEngine.off('loading', onLoading);
      voiceEngine.off('timeupdate', onTimeUpdate);
    };
  }, []);

  // ─── Stop audio on route change ───
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    voiceEngine.stop();
  }, [location.pathname]);

  // ─── Cleanup on unmount ───
  useEffect(() => () => voiceEngine.stop(), []);

  const play = useCallback((paragraphs, title, opts = {}) => {
    setError(null);
    if (!voiceEngine.isSupported()) {
      setError('Text-to-speech is not supported in this browser.');
      return;
    }
    const voice = voices.find(v => v.voiceURI === voiceURI) || null;
    setCurrentTrack({ id: opts.id || `${title}-${Date.now()}`, title, paragraphs, totalParas: paragraphs.length });
    setCurrentPara(opts.startPara || 0);
    setIsPlaying(true);
    setIsPaused(false);
    voiceEngine.speak(paragraphs, { voice, rate, startPara: opts.startPara || 0 });
  }, [voices, voiceURI, rate]);

  const pause = useCallback(() => voiceEngine.pause(), []);
  const resume = useCallback(() => voiceEngine.resume(), []);
  const stop = useCallback(() => voiceEngine.stop(), []);
  const skipBack15 = useCallback(() => voiceEngine.skipBack15(), []);
  const seekTo = useCallback((idx) => voiceEngine.seekParagraph(idx), []);

  const setRate = useCallback((r) => {
    setRateState(r);
    saveSetting('tts_rate', r);
    voiceEngine.updateRate(r);
  }, []);

  const setVoiceURI = useCallback((uri) => {
    setVoiceURIState(uri);
    saveSetting('tts_voice', uri);
    const v = voices.find(vc => vc.voiceURI === uri) || null;
    voiceEngine.updateVoice(v);
  }, [voices]);

  const setAutoPlay = useCallback((v) => {
    setAutoPlayState(v);
    saveSetting('tts_autoplay', v);
  }, []);

  // ─── Save/restore playback position per lesson ───
  const savePosition = useCallback((lessonId, paraIdx) => {
    try { localStorage.setItem(`erudite_tts_pos_${lessonId}`, String(paraIdx)); } catch {}
  }, []);

  const getPosition = useCallback((lessonId) => {
    try {
      const v = localStorage.getItem(`erudite_tts_pos_${lessonId}`);
      return v ? parseInt(v, 10) : 0;
    } catch { return 0; }
  }, []);

  // Auto-save position when currentPara changes
  useEffect(() => {
    if (currentTrack?.id && isPlaying) {
      savePosition(currentTrack.id, currentPara);
    }
  }, [currentPara, currentTrack, isPlaying, savePosition]);

  const value = {
    isPlaying, isPaused, isLoading, currentTrack, currentPara, audioProgress, rate, voiceURI, autoPlay, voices, error,
    play, pause, resume, stop, skipBack15, seekTo,
    setRate, setVoiceURI, setAutoPlay,
    savePosition, getPosition,
    isSupported: voiceEngine.isSupported(),
  };

  return (
    <ReadAloudContext.Provider value={value}>
      {children}
    </ReadAloudContext.Provider>
  );
}

export function useReadAloud() {
  const ctx = useContext(ReadAloudContext);
  if (!ctx) throw new Error('useReadAloud must be used within ReadAloudProvider');
  return ctx;
}