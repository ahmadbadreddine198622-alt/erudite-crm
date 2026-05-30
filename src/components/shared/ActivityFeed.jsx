import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, UserPlus, MessageCircle, CheckCircle, Clock, FileText, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const ICON_MAP = {
  whatsapp: MessageCircle,
  task: CheckCircle,
  note: FileText,
  stage_change: TrendingUp,
  assignment: UserPlus,
  system: Activity,
};

const COLOR_MAP = {
  whatsapp: 'text-emerald-500',
  task: 'text-blue-500',
  note: 'text-purple-400',
  stage_change: 'text-amber-500',
  assignment: 'text-emerald-500',
  system: 'text-slate-400',
};

export default function ActivityFeed({ limit = 10 }) {
  const { data: activities = [] } = useQuery({
    queryKey: ['activities-feed'],
    queryFn: () => base44.entities.LeadActivity.list('-created_date', limit),
  });

  const groupedActivities = useMemo(() => {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const groups = {
      today: [],
      yesterday: [],
      older: [],
    };

    activities.forEach(activity => {
      const activityDate = new Date(activity.created_date);
      if (activityDate >= today) {
        groups.today.push(activity);
      } else if (activityDate >= yesterday) {
        groups.yesterday.push(activity);
      } else {
        groups.older.push(activity);
      }
    });

    return groups;
  }, [activities]);

  const renderActivity = (activity) => {
    const Icon = ICON_MAP[activity.activity_type] || Activity;
    const colorClass = COLOR_MAP[activity.activity_type] || 'text-slate-400';

    return (
      <div key={activity.id} className="flex items-start gap-3 py-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{activity.title}</p>
          {activity.body && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{activity.body}</p>
          )}
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {format(new Date(activity.created_date), 'h:mm a')}
          </p>
        </div>
      </div>
    );
  };

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
          <Activity className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>Recent Activity</h3>
        </div>
      </div>

      <div className="space-y-4">
        {groupedActivities.today.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Today</p>
            <div className="space-y-1">
              {groupedActivities.today.map(renderActivity)}
            </div>
          </div>
        )}

        {groupedActivities.yesterday.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Yesterday</p>
            <div className="space-y-1">
              {groupedActivities.yesterday.map(renderActivity)}
            </div>
          </div>
        )}

        {groupedActivities.older.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Earlier</p>
            <div className="space-y-1">
              {groupedActivities.older.slice(0, 5).map(renderActivity)}
            </div>
          </div>
        )}

        {activities.length === 0 && (
          <div className="text-center py-8">
            <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}