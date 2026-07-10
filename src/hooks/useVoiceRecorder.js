// useVoiceRecorder — lightweight MediaRecorder hook for the modern composer.
// Returns start/stop controls plus the recorded blob. The caller decides what to
// do with the blob (send as audio attachment or transcribe to text).
//
// Usage:
//   const vr = useVoiceRecorder();
//   vr.start();             // begin recording (requests mic permission)
//   await vr.stop();         // stop -> vr.blob is the audio Blob (audio/webm)
//   vr.reset();              // clear blob + timer
//   vr.error                 // permission / unsupported message, if any

import { useState, useRef, useCallback, useEffect } from 'react';

export default function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const cleanup = useCallback(() => {
    stopTimer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Voice recording not supported on this device');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = mime || 'audio/webm';
        const b = new Blob(chunksRef.current, { type });
        setBlob(b);
        setRecording(false);
        stopTimer();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
          streamRef.current = null;
        }
      };
      rec.start();
      recorderRef.current = rec;
      mediaRef.current = rec;
      setRecording(true);
      setSeconds(0);
      setBlob(null);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      const msg = e?.name === 'NotAllowedError' ? 'Microphone permission denied'
        : e?.name === 'NotFoundError' ? 'No microphone found on this device'
        : e?.name === 'NotReadableError' ? 'Microphone is already in use by another app'
        : (e?.message || 'Could not start recording');
      setError(msg);
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(() => new Promise((resolve) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') { setRecording(false); stopTimer(); resolve(null); return; }
    rec.onstop = () => {
      const type = rec.mimeType || 'audio/webm';
      const b = new Blob(chunksRef.current, { type });
      setBlob(b);
      setRecording(false);
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
        streamRef.current = null;
      }
      resolve(b);
    };
    try { rec.stop(); } catch (_) { resolve(null); }
  }), []);

  const reset = useCallback(() => { setBlob(null); setSeconds(0); setError(''); }, []);

  return { recording, seconds, blob, busy, error, start, stop, reset };
}