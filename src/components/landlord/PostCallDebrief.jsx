// PostCallDebrief — shown after a copilot-enabled call ends and
// copilotCallComplete has saved the results. Shows the AI summary,
// what went well / what was missed (Brain Coach), the pre-filled
// CallQualification with one-tap "Confirm All", and suggested next action.
//
// Props:
//   callLogId    (string)
//   landlordId   (string)
//   debriefData  (object) — { summary, transcript, qualify_updates, signals } from relay
//   onConfirmAll (fn)     — called after the agent confirms the qualification
//   onClose      (fn)

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, X, FileCheck, Sparkles, Loader2, TrendingUp } from 'lucide-react';

const GOLD = '#d4af37';
const NAVY = '#0a0e1a';

function Section({ icon, label, children }) {
  return (
    <div style={{
      borderRadius: 10, padding: '10px 12px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

export default function PostCallDebrief({ callLogId, landlordId, debriefData, onConfirmAll, onClose }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [coachData, setCoachData] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);

  const summary = debriefData?.summary || '';
  const qualifyUpdates = debriefData?.qualify_updates || {};
  const signals = debriefData?.signals || {};
  const filledFields = Object.keys(qualifyUpdates).filter(k => qualifyUpdates[k] !== null && qualifyUpdates[k] !== '');

  // Run Brain Coach analysis on the transcript for "what went well / what was missed"
  useEffect(() => {
    if (!debriefData?.transcript || !landlordId) return;
    setCoachLoading(true);
    base44.functions.invoke('landlordConversationCoach', {
      landlord_id: landlordId,
      transcript: debriefData.transcript,
    })
      .then(res => {
        const data = res?.data ?? res;
        setCoachData(data);
      })
      .catch(() => {})
      .finally(() => setCoachLoading(false));
  }, [landlordId, debriefData?.transcript]);

  const handleConfirmAll = async () => {
    setConfirming(true);
    try {
      // Find the pending_confirmation CallQualification and confirm it
      const quals = await base44.entities.CallQualification.filter(
        { landlord_id: landlordId, source: 'copilot', status: 'pending_confirmation' },
        '-call_date', 5
      );
      if (quals?.length > 0) {
        await base44.entities.CallQualification.update(quals[0].id, { status: 'confirmed' });
      }
      setConfirmed(true);
      qc.invalidateQueries({ queryKey: ['call-qualifications', landlordId] });
      if (onConfirmAll) onConfirmAll();
    } catch (e) {
      console.error('Confirm failed:', e);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(212,175,55,0.25)',
      background: `linear-gradient(180deg, ${NAVY}, #0d1220)`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(212,175,55,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FileCheck size={13} style={{ color: GOLD }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: GOLD, fontFamily: 'var(--font-display)' }}>
            CALL DEBRIEF
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        )}
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Summary */}
        {summary && (
          <Section icon={<Sparkles size={11} style={{ color: GOLD }} />} label="AI Summary">
            <p style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)' }}>{summary}</p>
          </Section>
        )}

        {/* Brain Coach: what went well / what was missed */}
        <Section icon={<TrendingUp size={11} style={{ color: '#60a5fa' }} />} label="Brain Coach Analysis">
          {coachLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
              <Loader2 size={12} className="animate-spin" /> Analyzing call…
            </div>
          ) : coachData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {coachData.went_well && (
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#34d399' }}>✓ WENT WELL</span>
                  <p style={{ fontSize: 11, lineHeight: 1.4, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{coachData.went_well}</p>
                </div>
              )}
              {coachData.missed && (
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fca5a5' }}>⚠ MISSED</span>
                  <p style={{ fontSize: 11, lineHeight: 1.4, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{coachData.missed}</p>
                </div>
              )}
              {coachData.next_action && (
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: GOLD }}>→ NEXT ACTION</span>
                  <p style={{ fontSize: 11, lineHeight: 1.4, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{coachData.next_action}</p>
                </div>
              )}
              {!coachData.went_well && !coachData.missed && coachData.coaching && (
                <p style={{ fontSize: 11, lineHeight: 1.4, color: 'rgba(255,255,255,0.7)' }}>{coachData.coaching}</p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>No coaching data available.</p>
          )}
        </Section>

        {/* Pre-filled CallQualification */}
        {filledFields.length > 0 && (
          <Section icon={<FileCheck size={11} style={{ color: GOLD }} />} label={`Auto-Filled Qualification (${filledFields.length} fields)`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
              {filledFields.map(field => (
                <div key={field} style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: 100 }}>{field.replace(/_/g, ' ')}:</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{String(qualifyUpdates[field]).replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleConfirmAll}
              disabled={confirming || confirmed}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: confirmed ? 'default' : 'pointer',
                background: confirmed ? 'rgba(52,211,153,0.15)' : 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
                color: confirmed ? '#34d399' : '#1a1205',
                border: `1px solid ${confirmed ? 'rgba(52,211,153,0.4)' : 'hsl(38 92% 50% / 0.5)'}`,
              }}
            >
              {confirming ? <Loader2 size={12} className="animate-spin" /> : confirmed ? <CheckCircle2 size={12} /> : <CheckCircle2 size={12} />}
              {confirmed ? 'Confirmed' : confirming ? 'Confirming…' : 'Confirm All'}
            </button>
          </Section>
        )}

        {/* Suggested follow-up */}
        {coachData?.next_action && (
          <Section icon={<TrendingUp size={11} style={{ color: GOLD }} />} label="Suggested Follow-Up">
            <p style={{ fontSize: 11, lineHeight: 1.4, color: 'rgba(255,255,255,0.7)' }}>{coachData.next_action}</p>
          </Section>
        )}
      </div>
    </div>
  );
}