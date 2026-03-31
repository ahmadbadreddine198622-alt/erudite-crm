import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Award } from 'lucide-react';
import { formatAED } from '@/lib/constants';
import { subMonths, isAfter } from 'date-fns';

const PERIODS = [
  { label: 'This Month',   months: 1 },
  { label: '3 Months',    months: 3 },
  { label: '6 Months',    months: 6 },
  { label: 'This Year',   months: 12 },
];

export default function AgentCommissionReport({ commissions, invoices }) {
  const [period, setPeriod] = useState(1);

  const cutoff = subMonths(new Date(), period);

  const agentStats = useMemo(() => {
    const filtered = commissions.filter(c =>
      c.status !== 'cancelled' && isAfter(new Date(c.created_date), cutoff)
    );

    const stats = {};
    filtered.forEach(c => {
      const key = c.agent_email || c.agent_name || 'Unknown';
      if (!stats[key]) stats[key] = { name: c.agent_name || c.agent_email || 'Unknown', email: c.agent_email || '', deals: 0, revenue: 0, commission: 0 };
      stats[key].deals++;
      stats[key].revenue += c.deal_value_aed || 0;
      stats[key].commission += c.commission_amount_aed || 0;
    });

    return Object.values(stats).sort((a, b) => b.commission - a.commission);
  }, [commissions, period]);

  // Monthly breakdown for top agent
  const monthlyBreakdown = useMemo(() => {
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      months[key] = { name: key };
    }
    commissions.filter(c => c.status !== 'cancelled').forEach(c => {
      const d = new Date(c.created_date);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!months[key]) return;
      const agent = c.agent_name || c.agent_email || 'Unknown';
      months[key][agent] = (months[key][agent] || 0) + (c.commission_amount_aed || 0);
    });
    return Object.values(months);
  }, [commissions]);

  const topAgentNames = [...new Set(commissions.map(c => c.agent_name || c.agent_email).filter(Boolean))].slice(0, 5);
  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button
            key={p.months}
            onClick={() => setPeriod(p.months)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              period === p.months
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agentStats.map((agent, i) => (
          <Card key={agent.email || agent.name} className={i === 0 ? 'border-amber-300 bg-amber-50/40' : ''}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    {i === 0 && <Award className="w-4 h-4 text-amber-500" />}
                    <p className="font-bold text-sm">{agent.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{agent.email}</p>
                </div>
                <Badge variant="outline" className="text-xs">{agent.deals} deals</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commission Earned</span>
                  <span className="font-bold text-accent">{formatAED(agent.commission)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Deal Value</span>
                  <span className="font-medium">{formatAED(agent.revenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg per Deal</span>
                  <span className="font-medium">{agent.deals > 0 ? formatAED(agent.commission / agent.deals) : '—'}</span>
                </div>

                {/* Commission bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${Math.min(100, agentStats[0] ? (agent.commission / agentStats[0].commission) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {agentStats.length === 0 && (
          <Card className="col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No commission data for this period
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly Commission Chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Monthly Commission Trend (Last 6 Months)</CardTitle></CardHeader>
        <CardContent>
          {monthlyBreakdown.some(m => topAgentNames.some(a => m[a])) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyBreakdown} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatAED(v)} />
                {topAgentNames.map((name, i) => (
                  <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === topAgentNames.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No trend data yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}