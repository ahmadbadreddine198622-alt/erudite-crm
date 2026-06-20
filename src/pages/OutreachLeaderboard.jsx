import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { CheckCircle2, Circle, Target, Zap, Users, Trophy, TrendingUp, Loader2 } from 'lucide-react';

const TODAY = new Date().toISOString().slice(0, 10);

const STEP_KEYS = ['email_sent', 'whatsapp_sent', 'imessage_sent', 'sms_sent', 'called', 'qualification_logged'];
const STEP_LABELS = { email_sent: 'Email', whatsapp_sent: 'WA', imessage_sent: 'iMsg', sms_sent: 'SMS', called: 'Call', qualification_logged: 'Qualify' };

function getInitials(email = '') {
  const parts = email.split('@')[0].split('.');
  return parts.map(p => p[0]?.toUpperCase()).join('').slice(0, 2);
}

function getRankColor(idx) {
  if (idx === 0) return { text: 'text-amber-400', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' };
  if (idx === 1) return { text: 'text-slate-300', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' };
  if (idx === 2) return { text: 'text-amber-700', bg: 'rgba(120,53,15,0.15)', border: 'rgba(180,83,9,0.3)' };
  return { text: 'text-muted-foreground', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' };
}

export default function OutreachLeaderboard() {
  const { user } = useCurrentUser();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['outreach-leaderboard', TODAY],
    queryFn: () => base44.entities.OutreachChecklist.filter({ outreach_date: TODAY }),
    enabled: user?.role === 'admin',
    refetchInterval: 60000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: user?.role === 'admin',
  });

  if (!user) return null;
  if (user.role !== 'admin') {
    return (
      <div className="page-root flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  // Aggregate by agent
  const agentMap = {};
  for (const rec of records) {
    const email = rec.agent_email;
    if (!agentMap[email]) {
      agentMap[email] = {
        email,
        name: users.find(u => u.email === email)?.full_name || email.split('@')[0],
        landlords: 0,
        sequences: 0,
        steps: 0,
        qualifications: 0,
        reached: 0,
        stepCounts: {},
      };
      for (const k of STEP_KEYS) agentMap[email].stepCounts[k] = 0;
    }
    const a = agentMap[email];
    a.landlords++;
    if (rec.sequence_complete) a.sequences++;
    a.steps += rec.steps_completed || 0;
    if (rec.qualification_logged) a.qualifications++;
    if (rec.reached_landlord) a.reached++;
    for (const k of STEP_KEYS) {
      if (rec[k]) a.stepCounts[k]++;
    }
  }

  const agents = Object.values(agentMap).sort((a, b) => b.sequences - a.sequences || b.steps - a.steps);
  const totalRecords = records.length;
  const totalSequences = records.filter(r => r.sequence_complete).length;
  const totalQuals = records.filter(r => r.qualification_logged).length;

  return (
    <div className="page-root space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-amber-400" />
        <div>
          <h1 className="page-title text-2xl">Outreach Leaderboard</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Team totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Landlords Contacted', value: totalRecords, icon: Users, color: 'text-blue-400' },
          { label: 'Full Sequences', value: totalSequences, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Active Agents', value: agents.length, icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Qualifications', value: totalQuals, icon: Target, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && agents.length === 0 && (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">No outreach logged yet today.</p>
        </div>
      )}

      {/* Agent rows */}
      {agents.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>Agent Rankings</p>
          {agents.map((agent, idx) => {
            const colors = getRankColor(idx);
            const completionPct = agent.landlords > 0 ? Math.round((agent.sequences / agent.landlords) * 100) : 0;
            return (
              <div key={agent.email} className="rounded-xl p-4 space-y-3" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <span className={colors.text}>#{idx + 1}</span>
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0 border border-accent/30">
                    {getInitials(agent.email)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{agent.name}</p>
                    <p className="text-[10px] text-muted-foreground">{agent.email}</p>
                  </div>

                  {/* Key stats */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold tabular-nums text-emerald-400">{agent.sequences}</p>
                      <p className="text-[9px] text-muted-foreground">Sequences</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{agent.landlords}</p>
                      <p className="text-[9px] text-muted-foreground">Landlords</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold tabular-nums text-purple-400">{agent.qualifications}</p>
                      <p className="text-[9px] text-muted-foreground">Qualified</p>
                    </div>
                  </div>
                </div>

                {/* Step breakdown */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STEP_KEYS.map(key => {
                    const count = agent.stepCounts[key];
                    const done = count > 0;
                    return (
                      <div key={key} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
                        style={{ background: done ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border: done ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
                        {done ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> : <Circle className="w-2.5 h-2.5 text-muted-foreground" />}
                        <span className={done ? 'text-emerald-300' : 'text-muted-foreground'}>{STEP_LABELS[key]}</span>
                        <span className="font-bold tabular-nums" style={{ color: done ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>{count}</span>
                      </div>
                    );
                  })}
                  <div className="ml-auto text-[10px] text-muted-foreground">
                    {completionPct}% completion
                  </div>
                </div>

                {/* Completion bar */}
                <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: `${completionPct}%`,
                      background: completionPct >= 80 ? 'hsl(152 69% 40%)' : completionPct >= 40 ? 'hsl(38 92% 50%)' : 'rgba(239,68,68,0.7)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}