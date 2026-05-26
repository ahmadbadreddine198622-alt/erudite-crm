import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, MessageCircle, Mail, Users, CheckCircle2, Clock, UserCheck, TrendingUp, Zap } from 'lucide-react';

const DONUT_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4'];

const stageLabels = {
  new_lead: 'New Lead', contacted: 'Contacted', viewing_scheduled: 'Viewing Sched.',
  viewing_done: 'Viewing Done', negotiation: 'Negotiation', offer_made: 'Offer Made',
  closed_won: 'Won', closed_lost: 'Lost',
};
const stageColors = ['#3b82f6','#f59e0b','#8b5cf6','#6366f1','#f97316','#eab308','#10b981','#ef4444'];

const channelIcons = { call: Phone, whatsapp: MessageCircle, email: Mail };
const channelColors = { call: '#3b82f6', whatsapp: '#10b981', email: '#8b5cf6', unknown: '#94a3b8', form: '#f97316' };

function DonutChart({ data, total, centerLabel, centerValue, colors }) {
  return (
    <div className="relative w-48 h-48 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value} leads`, name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold">{centerValue}</span>
        <span className="text-xs text-muted-foreground mt-0.5">{centerLabel}</span>
      </div>
    </div>
  );
}

function CircleStat({ value, label, icon: IconComp, color, sublabel }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg border-4`} style={{ borderColor: color + '40', backgroundColor: color + '15' }}>
        <IconComp className="w-5 h-5 mb-0.5" style={{ color }} />
        <span className="text-xl font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function InsightsDashboard({ pfLeads, channelCounts, agentCounts, channelConfig }) {
  const total = pfLeads.length;

  // Channel donut data
  const channelData = Object.entries(channelCounts).map(([ch, v]) => ({ name: (channelConfig[ch] || {}).label || ch, value: v }));
  const channelColors2 = Object.keys(channelCounts).map(ch => channelColors[ch] || '#94a3b8');

  // Stage donut data
  const stageKeys = ['new_lead','contacted','viewing_scheduled','viewing_done','negotiation','offer_made','closed_won','closed_lost'];
  const stageData = stageKeys.map((s, i) => ({ name: stageLabels[s], value: pfLeads.filter(l => l.stage === s).length })).filter(d => d.value > 0);

  // Agent data
  const topAgents = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Metrics
  const repliedCount = pfLeads.filter(l => l.source_metadata && l.source_metadata.pf_status === 'replied').length;
  const withRecordings = pfLeads.filter(l => l.source_metadata && l.source_metadata.call_recording).length;
  const closedWon = pfLeads.filter(l => l.stage === 'closed_won').length;
  const newLeads = pfLeads.filter(l => l.stage === 'new_lead').length;

  return (
    <div className="space-y-6">
      {/* Top Circle Stats Row */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" /> Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-around gap-6">
            <CircleStat value={total} label="Total Leads" sublabel="from PF" icon={Users} color="#f59e0b" />
            <CircleStat value={newLeads} label="New Leads" sublabel="uncontacted" icon={TrendingUp} color="#3b82f6" />
            <CircleStat value={repliedCount} label="Replied" sublabel="by agent" icon={CheckCircle2} color="#10b981" />
            <CircleStat value={withRecordings} label="Recordings" sublabel="call logs" icon={Phone} color="#8b5cf6" />
            <CircleStat value={closedWon} label="Closed Won" sublabel="deals" icon={CheckCircle2} color="#10b981" />
            <CircleStat value={Object.keys(agentCounts).length} label="Agents" sublabel="active" icon={UserCheck} color="#f97316" />
          </div>
        </CardContent>
      </Card>

      {/* Donut Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Channel Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent" /> Leads by Channel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <div className="flex items-center gap-6">
                <DonutChart data={channelData} total={total} centerLabel="Total" centerValue={total} colors={channelColors2} />
                <div className="space-y-2.5 flex-1">
                  {channelData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: channelColors2[i] }} />
                        <span className="capitalize">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{d.value}</span>
                        <span className="text-muted-foreground text-xs ml-1">({total > 0 ? Math.round(d.value / total * 100) : 0}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground py-4 text-center">No data</p>}
          </CardContent>
        </Card>

        {/* Stage Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> Pipeline Stages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stageData.length > 0 ? (
              <div className="flex items-center gap-6">
                <DonutChart data={stageData} total={total} centerLabel="Leads" centerValue={total} colors={stageColors} />
                <div className="space-y-2 flex-1">
                  {stageData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stageColors[i % stageColors.length] }} />
                        <span className="text-xs">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{d.value}</span>
                        <span className="text-muted-foreground text-xs ml-1">({total > 0 ? Math.round(d.value / total * 100) : 0}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground py-4 text-center">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Agent Leaderboard + Auto-sync */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-accent" /> Agent Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent data</p>
            ) : (
              <div className="space-y-3">
                {topAgents.map(([agent, count], i) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                  return (
                    <div key={agent} className="flex items-center gap-3">
                      <span className="text-sm w-6 shrink-0">{medal}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate max-w-[160px]">{agent}</span>
                          <span className="font-bold shrink-0">{count} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full transition-all" style={{ width: pct + '%', backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Automation Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-green-200">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-sm text-green-700">Auto-Sync Active</p>
                <p className="text-xs text-muted-foreground">Every hour — preserves pipeline stage</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/60 rounded-xl border text-center">
                <p className="text-2xl font-bold text-primary">{total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Leads synced</p>
              </div>
              <div className="p-3 bg-white/60 rounded-xl border text-center">
                <p className="text-2xl font-bold text-accent">{repliedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Replied</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Webhook endpoint ready for real-time lead push from PropertyFinder.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}