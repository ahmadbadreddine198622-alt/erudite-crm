import React from 'react';
import { FileText, Phone, Mail, MessageCircle, Clock, CheckSquare, TrendingUp, Users, Home, FileCheck } from 'lucide-react';

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ status, type = 'default' }) {
  const styles = {
    default: { bg: 'rgba(148,163,184,0.15)', color: 'rgba(255,255,255,0.6)' },
    success: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  };
  const s = styles[type] || styles.default;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

const ICONS = {
  note: FileText, call: Phone, email: Mail, whatsapp: MessageCircle,
  sms: MessageCircle, viewing: Home, meeting: Users, task: CheckSquare,
  follow_up: Clock, document_shared: FileCheck, stage_change: TrendingUp,
};

export function ActivityItem({ activity }) {
  const Icon = ICONS[activity.type] || FileText;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Icon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{activity.title}</p>
          <StatusPill status={activity.status} type={activity.status === 'completed' ? 'success' : 'default'} />
        </div>
        {activity.description && (
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{activity.description}</p>
        )}
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {formatDateTime(activity.scheduled_at || activity.created_date)} · {activity.agent_name || activity.agent_email}
        </p>
      </div>
    </div>
  );
}

export function ActivityTab({ activities }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-10">
        <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No activity logged</p>
      </div>
    );
  }
  return <div>{activities.map((a, i) => <ActivityItem key={i} activity={a} />)}</div>;
}