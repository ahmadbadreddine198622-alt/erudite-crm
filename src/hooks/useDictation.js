import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getLangParams } from '@/lib/dictationSettings';
import { toast } from 'sonner';

/**
 * useDictation — live voice dictation hook.
 *
 * Primary engine: Deepgram streaming (nova-2, multi-language, interim results).
 * Fallback engine: browser webkitSpeechRecognition (continuous + interimResults).
 *
 * @param {Object} opts
 * @param {string} opts.value         — current text value of the bound field
 * @param {Function} opts.onChange   — setter that accepts a string
 * @param {string} opts.language     — 'auto' | 'en' | 'ar' | 'ru'
 */
export function useDictation({ value, onChange, language = 'auto' }) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const [analyser, setAnalyser] = useState(null);

  const baseTextRef = useRef('');
  const valueRef = useRef(value || '');
  const onChangeRef = useRef(onChange);
  const langRef = useRef(language);
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const socketRef = useRef(null);
  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const restartTimerRef = useRef(null);

  useEffect(() => { valueRef.current = value || ''; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { langRef.current = language; }, [language]);

  // ── Core: append interim/final text to the bound field ──
  const appendText = useCallback((text, isFinal) => {
    if (!text || !text.trim()) return;
    const base = baseTextRef.current;
    const needsSpace = base.length > 0 && !base.endsWith(' ') && !base.endsWith('\n');
    const sep = needsSpace ? ' ' : '';

    if (isFinal) {
      baseTextRef.current = base + sep + text.trim();
      onChangeRef.current?.(baseTextRef.current);
      setInterimText('');
    } else {
      onChangeRef.current?.(base + sep + text);
      setInterimText(text);
    }
  }, []);

  // ── Cleanup all resources ──
  const cleanup = useCallback(() => {
    isListeningRef.current = false;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    if (socketRef.current) {
      try { socketRef.current.close(); } catch (_) {}
      socketRef.current = null;
    }
    if (recorderRef.current) {
      if (recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch (_) {}
      }
      recorderRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
    analyserRef.current = null;
    setAnalyser(null);
  }, []);

  const stop = useCallback(() => {
    setIsListening(false);
    setInterimText('');
    cleanup();
  }, [cleanup]);

  // ── Cleanup on unmount ──
  useEffect(() => () => cleanup(), [cleanup]);

  // ── Stop on tab hide / page navigation ──
  useEffect(() => {
    const onVisibility = () => { if (document.hidden && isListeningRef.current) stop(); };
    const onBeforeUnload = () => { if (isListeningRef.current) cleanup(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [stop, cleanup]);

  // ── Fallback: webkitSpeechRecognition ──
  const startFallback = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('not-supported');
      toast.error('Voice dictation not supported. Use Chrome or Safari.');
      stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;

    const webkitLang = getLangParams(langRef.current).webkit;
    if (webkitLang) recognition.lang = webkitLang;

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText) appendText(finalText, true);
      else if (interim) appendText(interim, false);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('microphone-denied');
        toast.error('Microphone access denied. Allow microphone in browser settings.');
        stop();
      }
    };

    recognition.onend = () => {
      // Auto-restart for continuous mode — debounced + guarded to avoid the
      // InvalidStateError that fires when start() is called too soon, which
      // silently killed dictation mid-sentence.
      if (!isListeningRef.current) return;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (!isListeningRef.current) return;
        if (recognitionRef.current !== recognition) return;
        try {
          recognition.start();
        } catch (_) {
          try { recognition.abort(); } catch (__) {}
          try { recognition.start(); } catch (__) {}
        }
      }, 250);
    };

    try { recognition.start(); } catch (_) {}
  }, [appendText, stop]);

  // ── Primary: Deepgram streaming WebSocket ──
  const startDeepgram = useCallback(async (stream) => {
    let token = null;
    try {
      const res = await base44.functions.invoke('deepgramToken', {});
      token = res.data?.token;
    } catch (e) {
      console.warn('[useDictation] Deepgram token fetch failed:', e);
    }

    if (!token) {
      console.warn('[useDictation] No Deepgram token — using browser fallback');
      startFallback();
      return;
    }

    const langParam = getLangParams(langRef.current).deepgram;
    const params = new URLSearchParams({
      model: 'nova-2',
      interim_results: 'true',
      smart_format: 'true',
      punctuate: 'true',
      language: langParam,
    });

    let socket;
    let receivedAny = false;
    try {
      // Browser WebSocket auth — Deepgram requires the Sec-WebSocket-Protocol
      // subprotocol ['token', KEY]; query-param auth is NOT supported client-side.
      socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, ['token', token]);
    } catch (e) {
      startFallback();
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      try {
        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(e.data);
          }
        };

        recorder.start(100);
      } catch (e) {
        console.warn('[useDictation] MediaRecorder failed, falling back:', e);
        try { socket.close(); } catch (_) {}
        socketRef.current = null;
        startFallback();
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        const isFinal = data.is_final;
        if (transcript) { receivedAny = true; appendText(transcript, isFinal); }
      } catch (_) {}
    };

    socket.onerror = () => {
      if (socketRef.current === socket) {
        try { socket.close(); } catch (_) {}
        socketRef.current = null;
      }
      if (!recognitionRef.current) startFallback();
    };

    socket.onclose = () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch (_) {}
      }
      // Auth/handshake failures surface as an immediate close (not always onerror).
      // If we never received a single transcript and the user is still dictating,
      // switch to the browser fallback so the mic never dies silently.
      if (!receivedAny && isListeningRef.current && !recognitionRef.current) {
        console.warn('[useDictation] Deepgram socket closed before any transcript — falling back');
        startFallback();
      }
    };
  }, [appendText, startFallback]);

  // ── Start dictation ──
  const start = useCallback(async () => {
    if (isListeningRef.current) return;
    setError('');
    setInterimText('');
    baseTextRef.current = valueRef.current || '';
    isListeningRef.current = true;
    setIsListening(true);

    // 1. Get mic stream (also used for waveform analyser)
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('not-available');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      isListeningRef.current = false;
      setIsListening(false);
      setError('microphone-denied');
      toast.error('Microphone access denied. Click the lock icon, allow Microphone, and try again.');
      return;
    }
    micStreamRef.current = stream;

    // 2. AudioContext + AnalyserNode for the waveform
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;
      analyserNode.smoothingTimeConstant = 0.7;
      source.connect(analyserNode);
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);
    } catch (_) {}

    // 3. Start recognition — browser engine FIRST for instant feedback (no
    //    token fetch or WebSocket handshake delay), Deepgram only as fallback.
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      startFallback();
    } else {
      await startDeepgram(stream);
    }
  }, [startDeepgram, startFallback]);

  return { isListening, interimText, error, start, stop, analyser };
}