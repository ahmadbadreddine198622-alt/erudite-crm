import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, TrendingUp, Users, Eye } from 'lucide-react';
import { formatAED } from '@/lib/constants';

function GoalBar({ label, current, target, color, icon: Icon, format }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const displayVal = format === 'aed' ? formatAED(current) : current;
  const displayTarget = format === 'aed' ? formatAED(target) : target;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs font-bold">
          <span className={pct >= 100 ? 'text-emerald-600' : 'text-foreground'}>{displayVal}</span>
          <span className="text-muted-foreground"> / {displayTarget}</span>
        </span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? color : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground text-right">{pct.toFixed(0)}% of goal</p>
    </div>
  );
}

export default function AgentGoalCard({ goal, stats }) {
  if (!goal) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-8 text-center">
          <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No goals set for this month yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Ask your manager to set your monthly targets.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" />
          Monthly Goals — {goal.month}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {goal.target_deals > 0 && (
          <GoalBar label="Deals Closed" current={stats.closedWon} target={goal.target_deals} color="bg-indigo-500" icon={TrendingUp} />
        )}
        {goal.target_revenue_aed > 0 && (
          <GoalBar label="Commission Revenue" current={stats.revenue} target={goal.target_revenue_aed} color="bg-amber-500" icon={Target} format="aed" />
        )}
        {goal.target_leads > 0 && (
          <GoalBar label="Leads Acquired" current={stats.totalLeads} target={goal.target_leads} color="bg-blue-500" icon={Users} />
        )}
        {goal.target_viewings > 0 && (
          <GoalBar label="Viewings Conducted" current={stats.viewings} target={goal.target_viewings} color="bg-purple-500" icon={Eye} />
        )}
      </CardContent>
    </Card>
  );
}