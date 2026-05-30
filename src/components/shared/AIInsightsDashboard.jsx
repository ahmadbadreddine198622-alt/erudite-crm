import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, AlertTriangle, Target, Brain, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AIInsightsDashboard() {
  const navigate = useNavigate();
  
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 50),
  });

  // AI-curated insights
  const insights = useMemo(() => {
    // Hot leads (score >= 75)
    const hotLeads = leads
      .filter(l => (l.ai_lead_score || 0) >= 75 && l.stage !== 'closed_won' && l.stage !== 'closed_lost')
      .slice(0, 3)
      .map(l => ({
        type: 'hot_lead',
        title: l.full_name,
        subtitle: `Score: ${l.ai_lead_score}/100 · ${l.stage.replace(/_/g, ' ')}`,
        priority: 'high',
        action: 'Contact now',
        leadId: l.id,
      }));

    // At-risk deals (no activity in 7+ days, stage != closed)
    const now = new Date().getTime();
    const atRisk = deals
      .filter(d => {
        const lastContact = d.last_activity_at ? new Date(d.last_activity_at).getTime() : 0;
        const daysSince = (now - lastContact) / (1000 * 60 * 60 * 24);
        return daysSince > 7 && d.stage !== 'closed_won' && d.stage !== 'closed_lost';
      })
      .slice(0, 3)
      .map(d => ({
        type: 'at_risk',
        title: d.full_name,
        subtitle: `${Math.floor((now - new Date(d.last_activity_at || d.created_date).getTime()) / (1000 * 60 * 60 * 24))} days no contact`,
        priority: 'medium',
        action: 'Follow up',
        leadId: d.id,
      }));

    // Overdue reminders
    const overdue = reminders
      .filter(r => {
        const due = new Date(r.due_date).getTime();
        return due < now;
      })
      .slice(0, 2)
      .map(r => ({
        type: 'overdue',
        title: r.title,
        subtitle: `Was due ${new Date(r.due_date).toLocaleDateString()}`,
        priority: 'high',
        action: 'Complete now',
        reminderId: r.id,
      }));

    return [...hotLeads, ...atRisk, ...overdue].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [leads, deals, reminders]);

  if (insights.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Brain className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>No AI insights yet</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Keep using PropCRM to get personalized recommendations</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>AI Recommendations</h3>
        </div>
        <Badge
          style={{
            background: 'rgba(245,159,10,0.15)',
            border: '1px solid rgba(245,159,10,0.3)',
            color: 'hsl(38 92% 50%)',
          }}
        >
          {insights.length} actions
        </Badge>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="p-3 rounded-xl flex items-center justify-between gap-3"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${insight.priority === 'high' ? 'rgba(245,159,10,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: insight.type === 'hot_lead' ? 'rgba(16,185,129,0.15)' : insight.type === 'at_risk' ? 'rgba(245,159,10,0.15)' : 'rgba(239,68,68,0.15)',
                }}
              >
                {insight.type === 'hot_lead' ? (
                  <TrendingUp className="w-5 h-5" style={{ color: 'rgba(16,185,129,0.95)' }} />
                ) : insight.type === 'at_risk' ? (
                  <AlertTriangle className="w-5 h-5" style={{ color: 'rgba(245,159,10,0.95)' }} />
                ) : (
                  <Target className="w-5 h-5" style={{ color: 'rgba(239,68,68,0.95)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>{insight.title}</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{insight.subtitle}</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => insight.leadId ? navigate('/leads') : navigate('/reminders')}
              className="flex-shrink-0"
              style={{
                background: 'hsl(38 92% 50%)',
                color: 'hsl(222 47% 11%)',
              }}
            >
              {insight.action}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}