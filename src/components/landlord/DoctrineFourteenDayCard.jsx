import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Scale, TrendingUp, CheckCircle2, Activity } from 'lucide-react';

const LAW_TITLE = '14-Day Law — schedule next touch';

// Returns a Date object representing the start of "today" in Dubai time (UTC+4).
// Dubai has no DST, so it's a fixed +4 offset.
function startOfDubaiTodayUTC() {
  const now = new Date();
  const utcMs = now.getTime();
  const dubaiOffsetMs = 4 * 60 * 60 * 1000;
  const dubaiNow = new Date(utcMs + dubaiOffsetMs);
  const dubaiDateStr = dubaiNow.toISOString().slice(0, 10); // YYYY-MM-DD in Dubai
  // start of that Dubai day, expressed back as a UTC instant
  return new Date(dubaiDateStr + 'T00:00:00+04:00');
}

function rankByCount(map) {
  return Object.entries(map)
    .filter(([k]) => k)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count);
}

function agentDisplay(email) {
  if (!email) return 'Unassigned';
  const name = email.split('@')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function DoctrineFourteenDayCard({ isAdmin }) {
  // 1. 14-Day Law followups (open + cleared). Admins see all; non-admins see only their own (RLS).
  const { data: lawFups = [], isLoading: fupsLoading } = useQuery({
    queryKey: ['doctrine-14day-law-followups'],
    queryFn: async () => {
      const rows = await base44.entities.Followup.filter({ title: LAW_TITLE }, '-created_date', 500);
      return rows || [];
    },
  });

  // 2. Today's outbound touches across Message, IMessage, TelegramMessage, Email.
  const dubaiStart = startOfDubaiTodayUTC();
  const dubaiStartISO = dubaiStart.toISOString();

  const { data: touchesToday = [], isLoading: touchesLoading } = useQuery({
    queryKey: ['doctrine-14day-touches-today', dubaiStartISO],
    queryFn: async () => {
      // Fetch the most recent batch from each channel and filter to today's Dubai day.
      // RLS naturally scopes message reads to the agent's own records for non-admins.
      const [msgs, ims, tgs, ems] = await Promise.all([
        base44.entities.Message.filter({ direction: 'outgoing' }, '-timestamp', 500).catch(() => []),
        base44.entities.IMessage.filter({ direction: 'outbound' }, '-sent_at', 500).catch(() => []),
        base44.entities.TelegramMessage.filter({ direction: 'outbound' }, '-sent_at', 500).catch(() => []),
        base44.entities.Email.filter({ direction: 'outbound' }, '-received_at', 500).catch(() => []),
      ]);

      const tsField = (row, fields) => {
        for (const f of fields) {
          if (row[f]) {
            const t = new Date(row[f]).getTime();
            if (!isNaN(t)) return t;
          }
        }
        return 0;
      };

      const isToday = (row, fields) => tsField(row, fields) >= dubaiStart.getTime();

      const perAgent = {};
      const add = (row, fields) => {
        if (!isToday(row, fields)) return;
        const key = row.agent_email || 'unassigned';
        perAgent[key] = (perAgent[key] || 0) + 1;
      };

      (msgs || []).forEach((r) => add(r, ['timestamp']));
      (ims || []).forEach((r) => add(r, ['sent_at']));
      (tgs || []).forEach((r) => add(r, ['sent_at']));
      (ems || []).forEach((r) => add(r, ['received_at']));

      return rankByCount(perAgent);
    },
  });

  const isLoading = fupsLoading || touchesLoading;

  // Split law followups into open (pending) vs cleared (done).
  const openFups = lawFups.filter((f) => f.status === 'pending');
  const clearedFups = lawFups.filter((f) => f.status === 'done');

  // Per-agent breakdown of open violations.
  const openPerAgent = rankByCount(
    openFups.reduce((acc, f) => {
      const key = f.agent_email || 'unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  );

  const teamTouchTotal = touchesToday.reduce((sum, t) => sum + t.count, 0);

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
        >
          <Scale className="w-6 h-6" style={{ color: 'hsl(38 92% 55%)' }} />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            Sales Doctrine — The 14-Day Law
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {isAdmin ? 'Team-wide enforcement' : 'Your enforcement'} · No landlord sits silent past 14 days
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Section 1: Open Violations vs Cleared */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div
              className="rounded-xl p-5"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" style={{ color: '#f87171' }} />
                <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Open Violations
                </span>
              </div>
              <p className="text-4xl font-bold tabular-nums mb-3" style={{ color: '#f87171' }}>
                {openFups.length}
              </p>
              {openPerAgent.length > 0 ? (
                <div className="space-y-1">
                  {openPerAgent.slice(0, 5).map(({ email, count }) => (
                    <div key={email} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{agentDisplay(email)}</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.8)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No open violations 🎉</p>
              )}
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />
                <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Cleared
                </span>
              </div>
              <p className="text-4xl font-bold tabular-nums mb-3" style={{ color: '#34d399' }}>
                {clearedFups.length}
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Follow-ups resolved by the team since enforcement began.
              </p>
            </div>
          </div>

          {/* Section 2: Touches Today */}
          <div
            className="rounded-xl p-5 mb-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Touches Today (Outbound)
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>
                Team total: {teamTouchTotal}
              </span>
            </div>
            {touchesToday.length > 0 ? (
              <div className="space-y-1.5">
                {touchesToday.map(({ email, count }, idx) => (
                  <div key={email} className="flex items-center gap-3">
                    <span className="text-xs font-bold tabular-nums w-5 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{agentDisplay(email)}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${teamTouchTotal > 0 ? (count / teamTouchTotal) * 100 : 0}%`,
                          background: 'hsl(38 92% 50%)',
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color: 'rgba(255,255,255,0.9)' }}>{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-2" style={{ color: 'rgba(255,255,255,0.35)' }}>No outbound touches logged today yet.</p>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-sm font-medium italic pt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No landlord sits silent past 14 days.
          </p>
        </>
      )}
    </div>
  );
}