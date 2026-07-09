import React, { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GRANT_CARDONE_PERSONA_COMPACT } from '@/lib/grantCardoneVoice';
import { Loader2, Mic, Square, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import useVoiceRecorder from '@/hooks/useVoiceRecorder';
import { toast } from 'sonner';

// QuickQualifyBox — the FAST path for logging a qualification call.
//
// Instead of clicking through 12 dropdowns mid-call, the agent just dumps
// everything they learned in one freeform text box (or speaks it via mic).
// One tap on "AI Auto-Fill" and the LLM parses the natural-language dump
// into every structured field below — motivation, timeline, price, mandate,
// tenancy, mortgage, decision maker, outcome, rapport, next step, follow-up.
//
// Fields that were AI-filled get a gold ring so the agent can eyeball-verify
// before hitting Save.

const GOLD = 'hsl(38 92% 50%)';
const GOLD_DIM = 'rgba(250,180,40,0.15)';

export default function QuickQualifyBox({ form, setForm, onAutoFilled, landlord }) {
  const [text, setText] = useState('');
  const [filledFields, setFilledFields] = useState(new Set());
  const taRef = useRef(null);
  const vr = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);

  const hasText = !!(text || '').trim();

  const autoFillMutation = useMutation({
    mutationFn: async () => {
      const ownerName = landlord?.full_name_en || landlord?.full_name || 'the owner';
      const prompt = `${GRANT_CARDONE_PERSONA_COMPACT}

You are an assistant inside a Dubai real estate CRM. An agent just finished a qualification call with ${ownerName}. Instead of filling 12 dropdowns, the agent dumped a freeform brain-dump of everything they learned. Your job: parse that text and extract structured qualification data.

Return ONLY fields you can confidently identify from the text. For any field not mentioned, return null. Match enum values EXACTLY to the allowed options listed below.

ALLOWED VALUES:
- motivation: relocating, cashing_out, upgrading_downsizing, distressed_need_funds, inherited, poor_returns, just_testing_market, other, unknown
- timeline_urgency: asap_urgent, 1_3_months, 3_6_months, 6_12_months, no_rush_testing, unknown
- price_vs_valuation: realistic, slightly_high, significantly_overpriced, below_market, not_discussed
- mandate_openness: open_to_exclusive, non_exclusive_only, already_with_other_brokers, wants_to_self_sell, undecided, not_discussed
- tenancy_status: vacant, tenanted_lease_active, tenanted_lease_expiring, owner_occupied, unknown
- mortgage_status: free_and_clear, mortgaged_local, mortgaged_overseas, payment_plan, unknown
- is_decision_maker: sole_decision_maker, joint_needs_spouse, represents_owner, unknown
- call_outcome: interested_proceeding, needs_followup, callback_requested, thinking_about_it, not_ready, not_interested, no_answer, wrong_number, dead_lead
- rapport_after_call: cold, warming, rapport_built, trust_established, champion

For freeform fields (motivation_notes, competing_brokers, next_step), extract the relevant text verbatim or lightly cleaned.
For price_expectation_aed, extract the number (digits only, no currency).
For followup_date, extract as YYYY-MM-DD if mentioned, otherwise null.
For available_from, extract as YYYY-MM-DD if mentioned, otherwise null.

AGENT'S FREEFORM NOTES:
${text}`;

      return base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            motivation: { type: 'string' },
            motivation_notes: { type: 'string' },
            timeline_urgency: { type: 'string' },
            price_expectation_aed: { type: 'number' },
            price_vs_valuation: { type: 'string' },
            mandate_openness: { type: 'string' },
            competing_brokers: { type: 'string' },
            tenancy_status: { type: 'string' },
            available_from: { type: 'string' },
            mortgage_status: { type: 'string' },
            is_decision_maker: { type: 'string' },
            call_outcome: { type: 'string' },
            rapport_after_call: { type: 'string' },
            next_step: { type: 'string' },
            followup_date: { type: 'string' },
          },
        },
      });
    },
    onSuccess: data => {
      const updates = {};
      const filled = new Set();
      const fields = [
        'motivation', 'motivation_notes', 'timeline_urgency',
        'price_expectation_aed', 'price_vs_valuation',
        'mandate_openness', 'competing_brokers',
        'tenancy_status', 'available_from',
        'mortgage_status', 'is_decision_maker',
        'call_outcome', 'rapport_after_call',
        'next_step', 'followup_date',
      ];
      for (const k of fields) {
        const v = data?.[k];
        if (v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v))) {
          updates[k] = v;
          filled.add(k);
        }
      }
      if (Object.keys(updates).length === 0) {
        toast.error('Couldn\'t extract any fields from that text. Try adding more detail.');
        return;
      }
      setForm(f => ({ ...f, ...updates }));
      setFilledFields(filled);
      if (onAutoFilled) onAutoFilled(updates);
      toast.success(`✅ AI filled ${filled.size} field${filled.size === 1 ? '' : 's'} — verify & save`);
    },
    onError: e => toast.error(e?.message || 'AI parse failed'),
  });

  // ── Voice: record → upload → transcribe → insert ──
  const handleMic = async () => {
    if (vr.recording) {
      const blob = await vr.stop();
      vr.reset();
      if (!blob) return;
      setTranscribing(true);
      try {
        const file = new File([blob], `qualify-voice-${Date.now()}.webm`, { type: 'audio/webm' });
        const upRes = await base44.integrations.Core.UploadFile({ file });
        const audioUrl = upRes?.file_url || upRes?.data?.file_url || upRes?.url;
        if (!audioUrl) throw new Error('Upload failed');
        const trRes = await base44.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
        const transcript = typeof trRes === 'string' ? trRes : (trRes?.text || trRes?.data?.text || '');
        if (transcript) {
          setText(t => (t ? t + ' ' : '') + transcript + ' ');
          toast.success('🎤 Voice transcribed');
        }
      } catch (e) {
        toast.error('Transcription failed: ' + (e?.message || 'error'));
      } finally {
        setTranscribing(false);
      }
    } else {
      vr.start();
    }
  };

  const filledCount = filledFields.size;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: GOLD_DIM, borderColor: 'rgba(250,180,40,0.25)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(250,180,40,0.12)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(250,180,40,0.2)' }}>
          <Zap className="w-4 h-4" style={{ color: GOLD }} />
        </div>
        <div className="flex-1">
          <span className="text-xs font-bold" style={{ color: GOLD, fontFamily: 'var(--font-display)' }}>
            ⚡ Quick Qualify
          </span>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Dump everything from the call — AI fills every field below
          </p>
        </div>
        {filledCount > 0 && (
          <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {filledCount} filled
          </span>
        )}
      </div>

      {/* Textarea */}
      <div className="p-2.5">
        <textarea
          ref={taRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={
            "Type or speak freely… e.g.\n\"Owner relocating to London, wants 1.4M for 2BR in Marina. Mortgage free. Tenant leaves end of month. Open to exclusive. Sole owner on title. Interested, wants to move fast. Next: send CMA and Form A draft by Thursday.\""
          }
          rows={4}
          className="w-full resize-none rounded-lg px-3 py-2.5 text-xs leading-relaxed"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.9)',
            outline: 'none',
            minHeight: 80,
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(250,180,40,0.4)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />

        {/* Voice recording indicator */}
        {vr.recording && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-red-300">Recording… {vr.seconds}s</span>
            <span className="flex-1" />
            <button onClick={handleMic} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
              <Square className="w-2.5 h-2.5" /> Stop
            </button>
          </div>
        )}

        {vr.error && (
          <p className="text-[10px] text-red-400 px-2 mb-2">{vr.error}</p>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 mt-1">
          {/* Mic */}
          <button
            onClick={handleMic}
            disabled={transcribing || autoFillMutation.isPending}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-50"
            style={{
              background: vr.recording ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${vr.recording ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
            title={vr.recording ? 'Stop & transcribe' : 'Speak your notes'}
          >
            {transcribing
              ? <Loader2 className="w-4 h-4 animate-spin text-white/60" />
              : vr.recording
              ? <Square className="w-4 h-4 text-red-400" />
              : <Mic className="w-4 h-4 text-white/60" />}
          </button>

          {/* AI Auto-Fill */}
          <button
            onClick={() => autoFillMutation.mutate()}
            disabled={!hasText || autoFillMutation.isPending || transcribing}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{
              background: `linear-gradient(180deg, ${GOLD}, hsl(38 92% 46%))`,
              color: '#1a1205',
              border: '1px solid rgba(250,180,40,0.5)',
            }}
          >
            {autoFillMutation.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI parsing…</>
              : <><Sparkles className="w-3.5 h-3.5" /> AI Auto-Fill Fields</>}
          </button>

          {/* Clear */}
          {hasText && !autoFillMutation.isPending && (
            <button
              onClick={() => { setText(''); setFilledFields(new Set()); }}
              className="px-3 h-9 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}