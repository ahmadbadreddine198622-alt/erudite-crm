import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Lock, Loader2, CheckCircle, XCircle, BookOpen, ArrowLeft, Headphones } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import { GOLD, GOLD_LITE, pageWrap, card, goldStrip, serif, label, outlineBtn, input, rankPill } from '@/lib/academyStyles';

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

function LessonView({ principle, onBack }) {
  return (
    <div>
      <button onClick={onBack} style={{ ...outlineBtn, marginBottom: 14 }}><ArrowLeft size={13} /> Back to Library</button>

      <div style={card}>
        <div style={{ ...serif, fontSize: 48, color: GOLD, lineHeight: 1 }}>{principle.week_number}</div>
        <h2 style={{ ...serif, fontSize: 24, color: GOLD_LITE, margin: '4px 0 6px' }}>{principle.name}</h2>
        {principle.tagline && <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{principle.tagline}</p>}
        {principle.rank_title && <span style={{ ...rankPill, marginTop: 8, display: 'inline-flex' }}>{principle.rank_title}</span>}
      </div>

      {principle.essence && (
        <div style={{ ...goldStrip, marginTop: 14 }}>
          <p style={{ ...label, color: GOLD }}>Essence</p>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4, lineHeight: 1.5 }}>{principle.essence}</p>
        </div>
      )}

      {principle.erudite_lesson && (
        <div style={{ ...card, marginTop: 14 }}>
          <p style={label}>The Lesson</p>
          <div style={{ marginTop: 8 }}>
            {principle.erudite_lesson.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 1.65, marginBottom: 10 }}>{para}</p>
            ))}
          </div>
        </div>
      )}

      {principle.reading_assignment && (
        <div style={{ ...card, marginTop: 14 }}>
          <BookOpen size={16} style={{ color: GOLD }} />
          <p style={{ ...label, marginTop: 8 }}>Reading Assignment</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, lineHeight: 1.5 }}>{principle.reading_assignment}</p>
        </div>
      )}

      {principle.daily_drills?.length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <p style={label}>Daily Drills</p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {principle.daily_drills.map((d, i) => (
              <li key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, marginBottom: 4 }}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {principle.reflection_prompt && (
        <div style={{ ...card, marginTop: 14 }}>
          <p style={label}>Reflection Prompt</p>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 1.5, fontStyle: 'italic' }}>{principle.reflection_prompt}</p>
        </div>
      )}

      {principle.quiz_questions?.length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <p style={label}>Knowledge Check</p>
          {principle.quiz_questions.map((q, i) => <QuizQuestion key={i} q={q} index={i} />)}
        </div>
      )}
    </div>
  );
}

export default function TheHall() {
  const { user, isAdmin } = useCurrentUser();
  const [selected, setSelected] = useState(null);

  const { data: enrollments = [] } = useQuery({
    queryKey: ['academy-enrollment', user?.email],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const enrollment = enrollments[0];
  const currentWeek = enrollment?.current_week || 0;

  const { data: principles = [], isLoading } = useQuery({
    queryKey: ['academy-principles'],
    queryFn: async () => {
      const all = await base44.entities.TrainingPrinciple.list('week_number', 50);
      return all.filter(p => p.slug);
    },
  });
  const currentPrinciple = enrollment ? principles.find(p => p.week_number === enrollment.current_week) : null;

  if (isLoading) return (
    <div style={{ ...pageWrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" style={{ color: GOLD }} size={32} />
    </div>
  );

  if (selected) return <div style={pageWrap}><AcademyNav /><LessonView principle={selected} onBack={() => setSelected(null)} /></div>;

  return (
    <div style={pageWrap}>
      <AcademyNav />
      <p style={{ ...label, color: GOLD }}>where we learn it</p>
      <h1 style={{ ...serif, fontSize: 26, color: GOLD_LITE, margin: '2px 0 20px' }}>THE HALL</h1>

      {/* Current week reading & listening assignment */}
      {currentPrinciple?.reading_assignment && (
        <div style={goldStrip}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} style={{ color: GOLD }} />
            <p style={{ ...label, color: GOLD }}>Week {enrollment.current_week} Reading & Listening</p>
          </div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 6, lineHeight: 1.5 }}>{currentPrinciple.reading_assignment}</p>
        </div>
      )}

      {/* Principle library card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 16 }}>
        {principles.map(p => {
          const isPreview = !isAdmin && enrollment && p.week_number > currentWeek + 1;
          return (
            <button key={p.id} onClick={() => setSelected(p)} disabled={!isAdmin && p.week_number > currentWeek + 1}
              style={{
                ...card, cursor: isPreview ? 'default' : 'pointer', textAlign: 'left',
                opacity: isPreview ? 0.55 : 1, position: 'relative', transition: 'all 0.15s ease',
                minHeight: 140,
              }}
              onMouseEnter={e => { if (!isPreview) { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; } }}
              onMouseLeave={e => { if (!isPreview) { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)'; } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ ...serif, fontSize: 36, color: GOLD, lineHeight: 1 }}>{p.week_number}</span>
                {isPreview && <Lock size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
              </div>
              <h3 style={{ ...serif, fontSize: 17, color: GOLD_LITE, margin: '6px 0 4px' }}>{p.name}</h3>
              {p.tagline && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{p.tagline}</p>}
              {p.rank_title && <span style={{ ...rankPill, marginTop: 8, fontSize: 10 }}>{p.rank_title}</span>}
            </button>
          );
        })}
      </div>

      {/* Hill's Voice placeholder */}
      <div style={{ ...card, marginTop: 16, opacity: 0.55, textAlign: 'center', borderStyle: 'dashed' }}>
        <Headphones size={22} style={{ color: GOLD }} />
        <h3 style={{ ...serif, fontSize: 18, color: GOLD_LITE, marginTop: 8 }}>Hill's Voice</h3>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Daily listening segments — coming soon.</p>
      </div>

      {!enrollment && (
        <div style={{ ...goldStrip, marginTop: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Enroll in THE 17 to unlock the full library.</p>
        </div>
      )}
    </div>
  );
}