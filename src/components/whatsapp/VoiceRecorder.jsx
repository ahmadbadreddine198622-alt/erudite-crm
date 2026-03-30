import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Volume2, X } from 'lucide-react';

export default function VoiceRecorder({ onTranscribe }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    setIsProcessing(true);
    try {
      // Upload audio
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const { file_url } = await uploadRes.json();

      // Use LLM to transcribe with context
      const { base44 } = await import('@/api/base44Client');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Transcribe this WhatsApp voice message accurately and naturally. Return ONLY the transcribed text, no extra formatting.`,
        file_urls: [file_url],
        model: 'gemini_3_flash',
      });

      const text = result;
      setTranscript(text);
      onTranscribe(text);
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearTranscript = () => {
    setTranscript('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        {!isRecording ? (
          <Button
            size="sm"
            variant="outline"
            onClick={startRecording}
            className="gap-1 text-xs"
          >
            <Mic className="w-3.5 h-3.5 text-red-500" />
            Record Voice
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={stopRecording}
            className="gap-1 text-xs animate-pulse"
          >
            <Square className="w-3.5 h-3.5" />
            Stop Recording
          </Button>
        )}

        {isProcessing && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Transcribing...
          </div>
        )}
      </div>

      {transcript && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1">
              <Volume2 className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-foreground">{transcript}</p>
            </div>
            <button
              onClick={clearTranscript}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-[10px] text-blue-600">✓ Ready to send</div>
        </div>
      )}
    </div>
  );
}