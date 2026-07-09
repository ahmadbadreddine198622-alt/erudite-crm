// CopilotDebriefCard — shown after a copilot call ends. Displays:
//   - Call summary
//   - What went well / what was missed (Brain Coach LLM analysis)
//   - Pre-filled CallQualification (source=copilot) with "Confirm All" button
//   - Suggested follow-up action

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { QUESTION_BANK } from '@/components/landlord/qualifyQuestionBank';

const GOLD = '#d4af37';

function card() {
  return { borderRadius: 13, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' };
}

export default function CopilotDebriefCard({ callLogId, landlordId, onClose }) {
  const qc = useQueryClient();
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachData, setCoachData] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // Fetch the CallLog (for transcript + summary)
  const { data: callLog, isLoading: logLoading } = useQuery({
    queryKey: ['copilot_calllog', callLogId],
    queryFn: () => base44.entities.CallLog.get(callLogId),
    enabled: !!callLogId,
    refetchInterval: 3000,
  });

  // Fetch the copilot-sourced CallQualification
  const { data: qualifications = [] } = useQuery({
    queryKey: ['copilot_qual', callLogId, landlordId],
    queryFn: () => base44.entities.CallQualification.filter({ landlord_id: landlordId, source: 'copilot' }, '-call_date', 5),
    enabled: !!landlordId,
    refetchInterval: 3000,
  });

  const qual = qualifications.find(q => q.call_log_id === callLogId) || qualifications[0] || null;

  // Run Brain Coach analysis on the transcript
  const runCoach = async () => {
    if (!callLog?.transcript) return;
    setCoachLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Grant Cardone-style call coach. Analyze this sales call transcript and give:
1. WHAT WENT WELL — 2-3 bullet points on what the agent did right.
2. WHAT WAS MISSED — 2-3 bullet points on opportunities the agent missed (qualification gaps, objections not handled, next steps not locked in).
3. SUGGESTED FOLLOW-UP — one clear next action with timing.

Be direct, energetic, and specific. Keep each bullet under 15 words.

TRANSCRIPT:
${callLog.transcript}`,
        response_json_schema: {
          type: 'object',
          properties: {
            went_well: { type: 'array', items: { type: 'string' } },
            missed: { type: 'array', items: { type: 'string' } },
            follow_up: { type: 'string' },
          },
        },
      });
      setCoachData(res);
    } catch (_) {}
    setCoachLoading(false);
  };

  useEffect(() => {
    if (callLog?.transcript && !coachData && !coachLoading) runCoach();
  }, [callLog?.transcript]);

  const handleConfirmAll = async () => {
    if (!qual) return;
    setConfirming(true);
    try {
      await base44.entities.CallQualification.update(qual.id, { status: 'confirmed', ai_processed: true });
      qc.invalidateQueries({ queryKey: ['copilot_qual', callLogId, landlordId] });
      qc.invalidateQueries({ queryKey: ['call-qualifications', landlordId] });
    } catch (_) {}
    setConfirming(false);
  };

  const summary = callLog?.summary || '';
  const transcript = callLog?.transcript || '';
  const detectedFields = qual ? QUESTION_BANK.filter(q => qual[q.field_key]) : [];

  return (
    <div style={{ ...card(), padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: GOLD, fontFamily: "'Space Grotesk',sans-serif" }}>
            📋 Call Debrief
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '2px' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Summary */}
      {summary ? (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Summary</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)', fontFamily: "'Inter',sans-serif" }}>{summary}</p>
        </div>
      ) : logLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          <Loader2 size={12} className="animate-spin" /> Loading debrief…
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Waiting for relay to finalize call data…</div>
      )}

      {/* Brain Coach: what went well / missed */}
      {coachLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          <Loader2 size={12} className="animate-spin" /> Brain Coach analyzing…
        </div>
      )}
      {coachData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ ...card(), padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: 5 }}>✓ Went Well</div>
            {coachData.went_well?.map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 3, display: 'flex', gap: 4 }}>
                <span style={{ color: '#34d399' }}>•</span> {w}
              </div>
            ))}
          </div>
          <div style={{ ...card(), padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: 5 }}>✕ Missed</div>
            {coachData.missed?.map((m, i) => (
              <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 3, display: 'flex', gap: 4 }}>
                <span style={{ color: '#f87171' }}>•</span> {m}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested follow-up */}
      {coachData?.follow_up && (
        <div style={{ ...card(), padding: '10px 12px', borderColor: GOLD + '33', background: GOLD + '0a' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: GOLD, textTransform: 'uppercase', marginBottom: 4 }}>→ Follow-up</div>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>{coachData.follow_up}</p>
        </div>
      )}

      {/* Pre-filled qualification */}
      {qual && detectedFields.length > 0 && (
        <div style={{ ...card(), padding: '10px 12px', borderColor: GOLD + '33' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: GOLD, textTransform: 'uppercase' }}>
              🧠 AI-detected ({detectedFields.length} fields)
            </span>
            {qual.status === 'pending_confirmation' && (
              <button
                onClick={handleConfirmAll}
                disabled={confirming}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                  borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
                  color: '#1a1205', border: 'none', opacity: confirming ? 0.6 : 1,
                }}
              >
                {confirming ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Confirm All
              </button>
            )}
            {qual.status === 'confirmed' && (
              <span style={{ fontSize: 10, color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle2 size={11} /> Confirmed
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {detectedFields.map(q => {
              const val = qual[q.field_key];
              const label = q.options ? (q.options.find(o => o.value === val)?.label || val) : String(val);
              return (
                <span key={q.field_key} style={{ fontSize: 9.5, padding: '3px 7px', borderRadius: 6, background: GOLD + '12', border: `1px solid ${GOLD}33`, color: 'rgba(255,255,255,0.8)' }}>
                  <span style={{ color: GOLD, fontWeight: 700 }}>{q.area}:</span> {label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}