import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useNavigate } from 'react-router-dom';
import { Flame, ChevronRight } from 'lucide-react';
import { GOLD, GOLD_LITE } from '@/lib/academyStyles';

export default function AcademyStrip() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const { data: enrollments = [] } = useQuery({
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
  const principle = enrollment ? principles.find(p => p.week_number === enrollment.current_week) : null;

  return (
    <button
      onClick={() => navigate('/academy')}
      style={{
        width: '100%', margin: '0 auto 10px 0', display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
        background: 'linear-gradient(90deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))',
        border: '1px solid rgba(212,175,55,0.22)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(90deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06))'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(90deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))'; }}
    >
      <Flame size={15} style={{ color: GOLD, flexShrink: 0, filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.4))' }} />
      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: GOLD, fontFamily: "'Inter',sans-serif" }}>
          THE 17 {enrollment ? `· Week ${enrollment.current_week}` : ''}
        </p>
        <p style={{
          margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: "'Inter',sans-serif",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {enrollment
            ? (principle?.directive_text || `${principle?.name || 'Current week principle'}`)
            : 'Begin THE 17 — your 17-week transformation awaits.'}
        </p>
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: GOLD_LITE, fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
        {enrollment ? 'Open' : 'Begin'} <ChevronRight size={11} style={{ display: 'inline' }} />
      </span>
    </button>
  );
}