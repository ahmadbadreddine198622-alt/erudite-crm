import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Lock, Loader2, CheckCircle, XCircle, Swords } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import { GOLD, GOLD_LITE, pageWrap, card, goldStrip, serif, label, rankPill } from '@/lib/academyStyles';

function QuizQuestion({ q, index }) {
  const [selected, setSelected] = useState(null);
  const answered = selected !== null;
  const correct = answered && selected === q.correct_index;

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>{index + 1}. {q.question}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {q.options?.map((opt, i) => {
          const isCorrect = i === q.correct_index;
          const isSelected = i === selected;
          let bg = 'rgba(255,255,255,0.04)';
          let border = '1px solid rgba(255,255,255,0.08)';
          let color = 'rgba(255,255,255,0.7)';
          if (answered && isCorrect) { bg = 'rgba(52,211,153,0.12)'; border = '1px solid rgba(52,211,153,0.35)'; color = '#34d399'; }
          else if (answered && isSelected && !isCorrect) { bg = 'rgba(239,68,68,0.12)'; border = '1px solid rgba(239,68,68,0.35)'; color = '#f87171'; }
          return (
            <button key={i} disabled={answered} onClick={() => setSelected(i)}
              style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, background: bg, border, color, fontSize: 13, cursor: answered ? 'default' : 'pointer', fontFamily: "'Inter',sans-serif" }}>
              {answered && isCorrect && <CheckCircle size={12} style={{ display: 'inline', marginRight: 6 }} />}
              {answered && isSelected && !isCorrect && <XCircle size={12} style={{ display: 'inline', marginRight: 6 }} />}
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <p style={{ fontSize: 12, marginTop: 6, color: correct ? '#34d399' : '#f87171', fontWeight: 600 }}>
          {correct ? 'Correct.' : 'Incorrect — the right answer is highlighted above.'}
        </p>
      )}
    </div>
  );
}

export default function TheDojo() {
  const { user } = useCurrentUser();
  const [drillDone, setDrillDone] = useState({});

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['academy-enrollment', user?.email],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const enrollment = enrollments[0];

  const { data: principles = [] } = useQuery({
    queryKey: ['academy-principles'],
    queryFn: () => base44.entities.TrainingPrinciple.list('week_number', 20),
  });
  const currentPrinciple = enrollment ? principles.find(p => p.week_number === enrollment.current_week) : null;

  if (isLoading) return (
    <div style={{ ...pageWrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" style={{ color: GOLD }} size={32} />
    </div>
  );

  return (
    <div style={pageWrap}>
      <AcademyNav />
      <p style={{ ...label, color: GOLD }}>where we rehearse it</p>
      <h1 style={{ ...serif, fontSize: 26, color: GOLD_LITE, margin: '2px 0 20px' }}>THE DOJO</h1>

      {!enrollment ? (
        <div style={goldStrip}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Enroll in THE 17 to access your drills and knowledge checks.</p>
        </div>
      ) : currentPrinciple ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Current week header */}
          <div style={card}>
            <div style={{ ...serif, fontSize: 48, color: GOLD, lineHeight: 1 }}>{enrollment.current_week}</div>
            <h2 style={{ ...serif, fontSize: 24, color: GOLD_LITE, margin: '4px 0 6px' }}>{currentPrinciple.name}</h2>
            {currentPrinciple.tagline && <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{currentPrinciple.tagline}</p>}
          </div>

          {/* Daily drills checklist */}
          {currentPrinciple.daily_drills?.length > 0 ? (
            <div style={card}>
              <p style={label}>Daily Drills</p>
              {currentPrinciple.daily_drills.map((drill, i) => {
                const done = !!drillDone[i];
                return (
                  <button key={i} onClick={() => setDrillDone(d => ({ ...d, [i]: !d[i] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: done ? 'none' : '1px solid rgba(255,255,255,0.2)', background: done ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {done && <CheckCircle size={14} color="#0a0e1a" />}
                    </div>
                    <span style={{ fontSize: 14, color: done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.82)', textDecoration: done ? 'line-through' : 'none' }}>{drill}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={card}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>No daily drills for this week.</p>
            </div>
          )}

          {/* Knowledge checks */}
          {currentPrinciple.quiz_questions?.length > 0 && (
            <div style={card}>
              <p style={label}>Knowledge Check</p>
              {currentPrinciple.quiz_questions.map((q, i) => <QuizQuestion key={i} q={q} index={i} />)}
            </div>
          )}

          {/* Locked: The Sparring Ring */}
          <div style={{ ...card, opacity: 0.55, textAlign: 'center', borderStyle: 'dashed' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ position: 'relative' }}>
                <Swords size={22} style={{ color: GOLD }} />
                <Lock size={10} style={{ position: 'absolute', bottom: -2, right: -2, color: 'rgba(255,255,255,0.4)' }} />
              </div>
              <h3 style={{ ...serif, fontSize: 18, color: GOLD_LITE, marginTop: 8 }}>The Sparring Ring</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Negotiate against simulated landlords — coming soon.</p>
            </div>
          </div>
        </div>
      ) : (
        <div style={card}>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading your week's principle…</p>
        </div>
      )}
    </div>
  );
}