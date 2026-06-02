import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_APPS } from '@/lib/navApps';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

function AppIcon({ app, badge }) {
  const [pressed, setPressed] = useState(false);
  const size = 64;
  const radius = `${Math.round(size * 0.22)}px`;

  const inner = (
    <div
      className={cn('flex flex-col items-center gap-1.5 cursor-pointer select-none transition-transform duration-150',
        pressed ? 'scale-[0.93]' : 'scale-100'
      )}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      {/* Icon shell */}
      <div style={{ width: size, height: size, borderRadius: radius, position: 'relative', flexShrink: 0 }}>
        {/* Gradient base */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br', app.gradient)}
          style={{ borderRadius: radius }}
        />
        {/* Glass sheen */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 50%)',
            pointerEvents: 'none',
          }}
        />
        {/* Icon */}
        <app.icon
          className="absolute"
          style={{
            width: Math.round(size * 0.48),
            height: Math.round(size * 0.48),
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'rgba(255,255,255,0.95)',
            filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.45))',
          }}
        />
        {/* Badge */}
        {badge > 0 && (
          <div
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center px-1"
            style={{ fontSize: 10, color: '#fff', fontWeight: 700, boxShadow: '0 0 0 2px rgba(0,0,0,0.4)' }}
          >
            {badge > 99 ? '99+' : badge}
          </div>
        )}
      </div>
      {/* Label */}
      <span className="text-[11px] font-medium text-white/80 text-center leading-tight max-w-[72px] line-clamp-2">
        {app.label}
      </span>
    </div>
  );

  if (app.href) {
    return (
      <a href={app.href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return <Link to={app.path}>{inner}</Link>;
}

export default function Dashboard() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.full_name) setUserName(u.full_name);
      else if (u?.email) setUserName(u.email.split('@')[0]);
    }).catch(() => {});
  }, []);

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders-pending'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 50),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa-conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 50),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-count'],
    queryFn: () => base44.entities.Lead.list('-created_date', 50),
  });

  const badgeMap = {
    reminders: reminders.length,
    whatsapp: conversations.reduce((s, c) => s + (c.unread_count || 0), 0),
    leads: leads.filter(l => l.status === 'active').length,
  };

  // All apps excluding dashboard itself
  const gridApps = ALL_APPS;

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: 'linear-gradient(160deg, #0d1117 0%, #111827 60%, #0d1117 100%)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <p className="text-white/40 text-sm font-medium">Good day</p>
        <h1 className="text-2xl font-bold text-white">{userName || 'PropCRM'}</h1>
      </div>

      {/* App Grid */}
      <div className="px-4 pb-32">
        <div className="grid grid-cols-4 gap-x-2 gap-y-6">
          {gridApps.map((app) => (
            <div key={app.path} className="flex justify-center">
              <AppIcon
                app={app}
                badge={app.badgeKey ? (badgeMap[app.badgeKey] || 0) : 0}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}