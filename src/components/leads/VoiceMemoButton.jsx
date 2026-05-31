/**
 * VoiceMemoButton
 * Records a voice note → transcribes → analyzes with Claude → creates summary note + follow-up task.
 */

import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic, MicOff, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const STATES = { IDLE: 'idle', RECORDING: 'recording', PROCESSING: 'processing', DONE: 'done' };

export default function VoiceMemoButton({ lead }) {
  const [state, setState] = useState(STATES.IDLE);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const queryClient = useQueryClient();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(250);
      mediaRef.current = recorder;
      setState(STATES.RECORDING);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopAndProcess = () => {
    if (!mediaRef.current) return;
    clearInterval(timerRef.current);
    setState(STATES.PROCESSING);

    mediaRef.current.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice-memo.webm', { type: 'audio/webm' });

        // 1. Upload audio
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // 2. Transcribe
        const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });

        if (!transcript || transcript.trim().length < 3) {
          toast.error('Could not transcribe audio — please try again');
          setState(STATES.IDLE);
          return;
        }

        // 3. Analyze with Claude (sentiment, summary, follow-up)
        const claudeRes = await base44.functions.invoke('claudeAI', {
          prompt: `You are a CRM assistant for a Dubai real estate agency. 
Analyze this post-call voice memo for the lead "${lead.full_name || lead.name}" (stage: ${lead.stage || 'unknown'}, intent: ${lead.intent || 'unknown'}).

TRANSCRIPT:
"${transcript}"

Return a JSON object with:
{
  "summary": "<2-sentence plain-English summary of what was discussed and any commitments made>",
  "sentiment": "<positive | neutral | negative>",
  "sentiment_reason": "<one sentence explaining why>",
  "follow_up_task": "<specific actionable task title e.g. 'Send property shortlist for Downtown 2BR'>",
  "follow_up_due_hours": <number of hours from now, e.g. 24>
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              summary:           { type: 'string' },
              sentiment:         { type: 'string' },
              sentiment_reason:  { type: 'string' },
              follow_up_task:    { type: 'string' },
              follow_up_due_hours: { type: 'number' },
            },
          },
        });

        const analysis = claudeRes?.data || claudeRes || {};
        const summary = analysis.summary || transcript.slice(0, 300);
        const taskTitle = analysis.follow_up_task || 'Follow up with lead';
        const dueHours = analysis.follow_up_due_hours || 24;
        const sentiment = analysis.sentiment || 'neutral';

        const sentimentEmoji = { positive: '😊', neutral: '😐', negative: '😟' }[sentiment] || '😐';

        // 4. Create summary note activity
        await base44.entities.LeadActivity.create({
          lead_id: lead.id,
          activity_type: 'note',
          title: `${sentimentEmoji} Voice Memo — ${sentiment} sentiment`,
          body: `**Transcript:** ${transcript}\n\n**Summary:** ${summary}\n\n**Sentiment:** ${sentiment}${analysis.sentiment_reason ? ' — ' + analysis.sentiment_reason : ''}`,
          created_by: 'Voice Memo AI',
        });

        // 5. Create follow-up task activity
        const dueAt = new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString();
        await base44.entities.LeadActivity.create({
          lead_id: lead.id,
          activity_type: 'task',
          title: taskTitle,
          body: `Auto-created from voice memo analysis.`,
          due_at: dueAt,
          completed: false,
          created_by: 'Voice Memo AI',
        });

        queryClient.invalidateQueries({ queryKey: ['activities', lead.id] });
        queryClient.invalidateQueries({ queryKey: ['activities-summary', lead.id] });
        queryClient.invalidateQueries({ queryKey: ['ai-lead-summary', lead.id] });

        setState(STATES.DONE);
        toast.success('Voice memo saved — note & follow-up task created');
        setTimeout(() => setState(STATES.IDLE), 3000);
      } catch (err) {
        console.error('Voice memo error:', err);
        toast.error('Processing failed — please try again');
        setState(STATES.IDLE);
      }
    };

    mediaRef.current.stream.getTracks().forEach(t => t.stop());
    mediaRef.current.stop();
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (state === STATES.RECORDING) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={stopAndProcess}
        className="gap-1.5 border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10"
        style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
      >
        <MicOff className="w-4 h-4" />
        Stop {fmt(duration)}
      </Button>
    );
  }

  if (state === STATES.PROCESSING) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5 text-amber-400/80 border-amber-500/30">
        <Loader2 className="w-4 h-4 animate-spin" />
        Analyzing…
      </Button>
    );
  }

  if (state === STATES.DONE) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5 text-emerald-400 border-emerald-500/30">
        <CheckCircle2 className="w-4 h-4" />
        Saved
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={startRecording} className="gap-1.5" title="Record voice memo">
      <Mic className="w-4 h-4" />
      Voice Memo
    </Button>
  );
}