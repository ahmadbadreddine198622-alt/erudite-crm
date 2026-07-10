import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Flame, CheckCircle, Trophy, Loader2, BookOpen, ArrowRight, Target, Users, NotebookPen } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import { GOLD, GOLD_LITE, pageWrap, card, goldStrip, serif, label, goldBtn, outlineBtn, rankPill } from '@/lib/academyStyles';

export default function AcademyHome() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [drillDone, setDrillDone] = useState({});

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['academy-enrollment', user?.email],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const enrollment = enrollments[0];

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ['academy-leaderboard'],
    queryFn: () => base44.entities.TrainingEnrollment.list('-created_date', 50),
  });

  const { data: principles = [] } = useQuery({
    queryKey: ['academy-principles'],
    queryFn: () => base44.entities.TrainingPrinciple.list('week_number', 20),
  });
  const currentPrinciple = enrollment ? principles.find(p => p.week_number === enrollment.current_week) : null;

  const { data: affLogs = [] } = useQuery({
    queryKey: ['academy-affirmations', user?.email],
    queryFn: () => base44.entities.DailyAffirmationLog.filter({ user_email: user?.email }, '-log_date', 1),
    enabled: !!user?.email,
  });
  const streak = affLogs[0]?.current_streak || 0;

  const enrollMut = useMutation({
    mutationFn: () => base44.entities.TrainingEnrollment.create({
      user_email: user.email,
      agent_name: user.display_name || user.full_name || user.email,
      current_week: 1,
      weeks_completed: [],
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academy-enrollment'] });
      toast.success('Welcome to THE 17 — Week 1 begins now.');
    },
  });

  if (isLoading) return (
    <div style={{ ...pageWrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" style={{ color: GOLD }} size={32} />
    </div>
  );

  // ── No enrollment: cinematic hero ──
  if (!enrollment) {
    return (
      <div style={{ ...pageWrap, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '78vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <div style={{ width: 96, height: 96, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: 'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.35)', boxShadow: '0 0 60px rgba(212,175,55,0.15)' }}>
            <Flame size={44} style={{ color: GOLD, filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.5))' }} />
          </div>
          <p style={{ ...label, color: GOLD, marginTop: 24 }}>Erudite Success Academy</p>
          <h1 style={{ ...serif, fontSize: 48, color: GOLD_LITE, margin: '8px 0 12px', lineHeight: 1 }}>THE 17</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 28px' }}>
            17 weeks. 17 principles. One transformation from agent to master.
          </p>
          <button onClick={() => enrollMut.mutate()} disabled={enrollMut.isPending} style={{ ...goldBtn, fontSize: 16, padding: '14px 32px' }}>
            {enrollMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
            Begin Week 1
          </button>
        </div>
      </div>
    );
  }

  const leaderboard = [...allEnrollments].sort((a, b) =>
    (b.weeks_completed?.length || 0) - (a.weeks_completed?.length || 0)
  );

  return (
    <div style={pageWrap}>
      <AcademyNav />

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ ...label, color: GOLD }}>THE 17 · Erudite Success Academy</p>
        <h1 style={{ ...serif, fontSize: 26, color: 'rgba(255,255,255,0.95)', margin: '2px 0 0' }}>
          Week {enrollment.current_week}{currentPrinciple ? ` — ${currentPrinciple.name}` : ''}
        </h1>
      </div>

      {currentPrinciple ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Principle name */}
          <div style={card}>
            <div style={{ ...serif, fontSize: 52, color: GOLD, lineHeight: 1 }}>{enrollment.current_week}</div>
            <h2 style={{ ...serif, fontSize: 24, color: GOLD_LITE, margin: '4px 0 6px' }}>{currentPrinciple.name}</h2>
            {currentPrinciple.tagline && <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{currentPrinciple.tagline}</p>}
            {currentPrinciple.rank_title && <span style={{ ...rankPill, marginTop: 8 }}>{currentPrinciple.rank_title}</span>}
          </div>

          {/* Directive strip */}
          {currentPrinciple.directive_text && (
            <div style={goldStrip}>
              <p style={{ ...label, color: GOLD }}>Directive</p>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4, lineHeight: 1.5 }}>{currentPrinciple.directive_text}</p>
            </div>
          )}

          {/* Daily drills */}
          {currentPrinciple.daily_drills?.length > 0 && (
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
          )}

          {/* Reading + streak */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {currentPrinciple.reading_assignment && (
              <div style={{ ...card, flex: '1 1 280px' }}>
                <BookOpen size={16} style={{ color: GOLD }} />
                <p style={{ ...label, marginTop: 8 }}>Reading Assignment</p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, lineHeight: 1.5 }}>{currentPrinciple.reading_assignment}</p>
              </div>
            )}
            <div style={{ ...card, flex: '1 1 180px', textAlign: 'center' }}>
              <Flame size={16} style={{ color: GOLD }} />
              <p style={{ ...label, marginTop: 8 }}>Affirmation Streak</p>
              <p style={{ ...serif, fontSize: 36, color: GOLD_LITE, lineHeight: 1, margin: '2px 0' }}>{streak} <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>days</span></p>
              <Link to="/academy/chief-aim" style={{ fontSize: 12, color: GOLD, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>Morning Affirmation →</Link>
            </div>
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/academy/principles" style={outlineBtn}><BookOpen size={13} /> Principle Library</Link>
            <Link to="/academy/reflections" style={outlineBtn}><NotebookPen size={13} /> Submit Reflection</Link>
            <Link to="/academy/mastermind" style={outlineBtn}><Users size={13} /> Mastermind</Link>
          </div>
        </div>
      ) : (
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading your week's principle…</p>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Trophy size={16} style={{ color: GOLD }} />
            <h3 style={{ ...serif, fontSize: 18, color: 'rgba(255,255,255,0.9)' }}>Team Leaderboard</h3>
          </div>
          <div style={{ ...card, padding: 0 }}>
            {leaderboard.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ ...serif, fontSize: 20, color: i === 0 ? GOLD : 'rgba(255,255,255,0.35)', width: 28 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{e.agent_name || e.user_email}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Week {e.current_week} · {e.weeks_completed?.length || 0} completed</p>
                </div>
                {e.rank && <span style={rankPill}>{e.rank}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}