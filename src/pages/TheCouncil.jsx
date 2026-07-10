import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Trophy } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import CouncilReflections from '@/components/academy/CouncilReflections';
import CouncilMastermind from '@/components/academy/CouncilMastermind';
import { GOLD, GOLD_LITE, pageWrap, card, serif, label, rankPill } from '@/lib/academyStyles';

const TABS = [
  { key: 'reflections', label: 'Reflections' },
  { key: 'mastermind', label: 'Mastermind' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'scores', label: 'My Scores' },
];

export default function TheCouncil() {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState('reflections');

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ['academy-leaderboard'],
    queryFn: () => base44.entities.TrainingEnrollment.list('-created_date', 50),
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['academy-scores', user?.email],
    queryFn: () => base44.entities.PrincipleScoreSnapshot.filter({ user_email: user?.email }, '-snapshot_date', 50),
    enabled: !!user?.email,
  });

  const leaderboard = [...allEnrollments].sort((a, b) =>
    (b.weeks_completed?.length || 0) - (a.weeks_completed?.length || 0)
  );

  return (
    <div style={pageWrap}>
      <AcademyNav />
      <p style={{ ...label, color: GOLD }}>where we prove it</p>
      <h1 style={{ ...serif, fontSize: 26, color: GOLD_LITE, margin: '2px 0 20px' }}>THE COUNCIL</h1>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            background: tab === t.key ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
            border: tab === t.key ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.1)',
            color: tab === t.key ? GOLD : 'rgba(255,255,255,0.6)',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'reflections' && <CouncilReflections />}
      {tab === 'mastermind' && <CouncilMastermind />}

      {tab === 'leaderboard' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Trophy size={16} style={{ color: GOLD }} />
            <h3 style={{ ...serif, fontSize: 18, color: 'rgba(255,255,255,0.9)' }}>Team Leaderboard</h3>
          </div>
          {leaderboard.length === 0 ? (
            <div style={card}><p style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>No enrollments yet.</p></div>
          ) : (
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
          )}
        </div>
      )}

      {tab === 'scores' && (
        <div>
          <h3 style={{ ...serif, fontSize: 18, color: 'rgba(255,255,255,0.9)', marginBottom: 10 }}>Principle Score History</h3>
          {scores.length === 0 ? (
            <div style={card}><p style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>No score snapshots yet. They appear after your reflections are graded.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scores.map(s => (
                <div key={s.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...serif, fontSize: 18, color: GOLD }}>W{s.week_number}</span>
                    <span style={{ ...rankPill, background: s.score >= 75 ? 'rgba(52,211,153,0.12)' : s.score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', borderColor: s.score >= 75 ? 'rgba(52,211,153,0.3)' : s.score >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)', color: s.score >= 75 ? '#34d399' : s.score >= 50 ? GOLD_LITE : '#f87171' }}>
                      Score: {s.score}
                    </span>
                    {s.snapshot_date && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{new Date(s.snapshot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}