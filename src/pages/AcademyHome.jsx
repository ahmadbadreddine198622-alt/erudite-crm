import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Flame, Loader2, ChevronRight } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import { CHAMBERS } from '@/lib/academyChambers';
import { GOLD, GOLD_LITE, pageWrap, card, serif, label, goldBtn, rankPill } from '@/lib/academyStyles';

export default function AcademyHome() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['academy-enrollment', user?.email],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const enrollment = enrollments[0];

  const { data: principles = [] } = useQuery({
    queryKey: ['academy-principles'],
    queryFn: () => base44.entities.TrainingPrinciple.list('week_number', 20),
    enabled: !!enrollment,
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

  return (
    <div style={pageWrap}>
      <AcademyNav />

      {/* Current week header */}
      <div style={card}>
        <p style={{ ...label, color: GOLD }}>THE 17 · Week {enrollment.current_week}</p>
        {currentPrinciple ? (
          <>
            <div style={{ ...serif, fontSize: 52, color: GOLD, lineHeight: 1, marginTop: 6 }}>{enrollment.current_week}</div>
            <h1 style={{ ...serif, fontSize: 28, color: GOLD_LITE, margin: '4px 0 6px' }}>{currentPrinciple.name}</h1>
            {currentPrinciple.tagline && <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>{currentPrinciple.tagline}</p>}
            {currentPrinciple.rank_title && <span style={{ ...rankPill, marginTop: 8, display: 'inline-flex' }}>{currentPrinciple.rank_title}</span>}

            {/* Streak */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Flame size={16} style={{ color: GOLD }} />
              <span style={{ ...serif, fontSize: 28, color: GOLD_LITE, lineHeight: 1 }}>{streak}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>day affirmation streak</span>
            </div>
          </>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Loading your week's principle…</p>
        )}
      </div>

      {/* Five chamber cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 18 }}>
        {CHAMBERS.map(c => {
          const Icon = c.icon;
          return (
            <Link key={c.to} to={c.to} style={{
              ...card, cursor: 'pointer', textAlign: 'left', textDecoration: 'none',
              transition: 'all 0.15s ease', position: 'relative',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)'; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                <Icon size={22} style={{ color: GOLD }} />
              </div>
              <h3 style={{ ...serif, fontSize: 20, color: GOLD_LITE, margin: '12px 0 2px' }}>{c.name}</h3>
              <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{c.motto}</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8, lineHeight: 1.5 }}>{c.desc}</p>
              <ChevronRight size={16} style={{ color: GOLD, position: 'absolute', top: 20, right: 20, opacity: 0.5 }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}