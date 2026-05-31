import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Target, Flame, AlertTriangle, TrendingUp, Users, Filter, ChevronRight, CheckCircle2 } from 'lucide-react';
import LeadPriorityCard from '@/components/leads/LeadPriorityCard';
import { Badge } from '@/components/ui/badge';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-amber-400' }) { // eslint-disable-line
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/8 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs text-white/50">{label}</p>
        {sub && <p className="text-[11px] text-white/35 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Score Distribution Bar Chart ─────────────────────────────────────────────
function ScoreDistributionChart({ leads }) {
  const buckets = [
    { range: '0–24', min: 0, max: 24, color: '#ef4444' },
    { range: '25–49', min: 25, max: 49, color: '#f97316' },
    { range: '50–74', min: 50, max: 74, color: '#f59e0b' },
    { range: '75–100', min: 75, max: 100, color: '#10b981' },
  ].map(b => ({
    ...b,
    count: leads.filter(l => (l.ai_lead_score || 0) >= b.min && (l.ai_lead_score || 0) <= b.max).length,
  }));

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white/80 mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={buckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="range" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'rgba(20,28,48,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {buckets.map((b, i) => <Cell key={i} fill={b.color} fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Radar Chart for a selected lead ─────────────────────────────────────────
function LeadRadar({ lead }) {
  if (!lead) return null;
  const bd = lead.ai_lead_score_breakdown || {};
  const data = [
    { subject: 'Budget', value: bd.budget_fit || 0 },
    { subject: 'Authority', value: bd.authority || 0 },
    { subject: 'Need', value: bd.need_clarity || 0 },
    { subject: 'Urgency', value: bd.timeline_urgency || 0 },
    { subject: 'Engage', value: bd.engagement || 0 },
    { subject: 'Inventory', value: bd.inventory_match || 0 },
  ];
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-semibold text-white/60 mb-1">Score Breakdown</p>
      <p className="text-sm font-bold text-white mb-3 truncate">{lead.full_name}</p>
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} />
          <Radar name="Score" dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Churn Risk Panel ─────────────────────────────────────────────────────────
function ChurnRiskPanel({ leads }) {
  const atRisk = leads.filter(l => ['high', 'critical'].includes(l.ai_churn_prediction?.risk_level));
  if (atRisk.length === 0) return (
    <div className="glass-card rounded-xl p-5 flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-white">No high-risk churn</p>
        <p className="text-xs text-white/40">All leads look healthy</p>
      </div>
    </div>
  );
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
        <h3 className="text-sm font-semibold text-white/80">Churn Risk</h3>
        <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{atRisk.length}</Badge>
      </div>
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {atRisk.map(l => (
          <div key={l.id} className="flex items-center justify-between text-xs">
            <span className="text-white/80 truncate flex-1">{l.full_name}</span>
            <span className={`jewel-pill shrink-0 ml-2 ${l.ai_churn_prediction.risk_level === 'critical' ? 'jewel-rose' : 'jewel-amber'}`}>
              {l.ai_churn_prediction.risk_level}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Buyers', 'Tenants', 'Hot (75+)', 'Stale (5d+)', 'At Risk'];

export default function LeadScoringDashboard() {
  const [filter, setFilter] = useState('All');
  const [selectedLead, setSelectedLead] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-scoring'],
    queryFn: () => base44.entities.Lead.filter({ status: 'active' }, '-ai_lead_score', 200),
  });

  // Aggregate stats
  const stats = useMemo(() => {
    const scored = leads.filter(l => l.ai_lead_score != null);
    const avg = scored.length ? Math.round(scored.reduce((s, l) => s + l.ai_lead_score, 0) / scored.length) : 0;
    const hot = leads.filter(l => (l.ai_lead_score || 0) >= 75).length;
    const stale = leads.filter(l => (l.days_since_last_contact || 0) >= 5).length;
    const rising = leads.filter(l => l.ai_score_trend === 'rising').length;
    return { total: leads.length, avg, hot, stale, rising };
  }, [leads]);

  // Filtered + sorted lead list
  const filteredLeads = useMemo(() => {
    let list = [...leads];
    if (filter === 'Buyers') list = list.filter(l => l.intent === 'buyer');
    else if (filter === 'Tenants') list = list.filter(l => l.intent === 'tenant');
    else if (filter === 'Hot (75+)') list = list.filter(l => (l.ai_lead_score || 0) >= 75);
    else if (filter === 'Stale (5d+)') list = list.filter(l => (l.days_since_last_contact || 0) >= 5);
    else if (filter === 'At Risk') list = list.filter(l => ['high', 'critical'].includes(l.ai_churn_prediction?.risk_level));
    return list.sort((a, b) => (b.ai_lead_score || 0) - (a.ai_lead_score || 0));
  }, [leads, filter]);

  // Today's follow-up priority (top 10 by composite urgency + score + staleness)
  const followUpList = useMemo(() => {
    return leads
      .filter(l => l.status === 'active' && l.stage !== 'closed')
      .map(l => {
        const score = l.ai_lead_score || 0;
        const daysStale = Math.min(l.days_since_last_contact || 0, 14);
        const urgency = (l.ai_lead_score_breakdown?.timeline_urgency || 0);
        const churnBoost = l.ai_churn_prediction?.risk_level === 'critical' ? 30 : l.ai_churn_prediction?.risk_level === 'high' ? 15 : 0;
        const priority = score * 0.4 + urgency * 0.3 + daysStale * 2 + churnBoost;
        return { ...l, _priority: priority };
      })
      .sort((a, b) => b._priority - a._priority)
      .slice(0, 10);
  }, [leads]);

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title text-2xl">Lead Scoring Dashboard</h1>
        <p className="page-subtitle mt-1">AI-powered prioritization — focus on leads most likely to convert today</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users} label="Active Leads" value={stats.total} color="text-blue-400" />
        <StatCard icon={Target} label="Avg AI Score" value={stats.avg} sub="out of 100" color="text-amber-400" />
        <StatCard icon={Flame} label="Hot Leads (75+)" value={stats.hot} sub="ready to act" color="text-emerald-400" />
        <StatCard icon={TrendingUp} label="Rising Scores" value={stats.rising} sub="momentum" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Priority List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-white/40 shrink-0" />
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-amber-500/25 text-amber-400 border border-amber-500/40'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                }`}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-xs text-white/35">{filteredLeads.length} leads</span>
          </div>

          {/* Lead cards */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="glass-card rounded-xl h-28 animate-pulse" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-white/40 text-sm">No leads match this filter.</div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredLeads.map((lead, i) => (
                <LeadPriorityCard
                  key={lead.id}
                  lead={lead}
                  rank={i + 1}
                  onSelect={setSelectedLead}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Insights Panel */}
        <div className="space-y-4">
          {/* Score Distribution */}
          <ScoreDistributionChart leads={leads} />

          {/* Selected lead radar */}
          {selectedLead ? (
            <LeadRadar lead={selectedLead} />
          ) : (
            <div className="glass-card rounded-xl p-5 text-center text-white/30 text-xs border border-dashed border-white/10">
              <Target className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Tap a lead to see score breakdown
            </div>
          )}

          {/* Churn Risk */}
          <ChurnRiskPanel leads={leads} />

          {/* Today's Follow-up List */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white/80">Today's Priority List</h3>
            </div>
            <div className="space-y-2">
              {followUpList.map((lead, i) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 rounded px-1 transition-colors"
                  onClick={() => setSelectedLead(lead)}
                >
                  <span className="text-white/30 w-4 shrink-0">{i + 1}.</span>
                  <span className="flex-1 text-white/85 truncate font-medium">{lead.full_name}</span>
                  <span className={`tabular-nums font-bold shrink-0 ${(lead.ai_lead_score || 0) >= 75 ? 'text-emerald-400' : (lead.ai_lead_score || 0) >= 50 ? 'text-amber-400' : 'text-orange-400'}`}>
                    {lead.ai_lead_score || '–'}
                  </span>
                  <ChevronRight className="w-3 h-3 text-white/25 shrink-0" />
                </div>
              ))}
              {followUpList.length === 0 && <p className="text-white/30 text-xs text-center py-2">No active leads</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}