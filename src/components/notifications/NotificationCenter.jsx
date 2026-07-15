import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Bell, Check, CheckCheck, Phone, Mail, MessageSquare, Eye,
  Calendar, FileText, FileSignature, TrendingUp, Users, UserPlus,
  Clock, AlertCircle, Trash2, X,
} from 'lucide-react';
import {
  unlockNotificationSound, playNotificationSound, requestNotificationPermission,
} from '@/lib/notificationSound';

const TYPE_CONFIG = {
  lead_assigned:      { icon: UserPlus,      color: '#5a93e0', bg: 'rgba(90,147,224,0.15)' },
  landlord_assigned:  { icon: Users,         color: '#c9a24b', bg: 'rgba(201,162,75,0.15)' },
  deal_won:           { icon: TrendingUp,     color: '#3fb98a', bg: 'rgba(63,185,138,0.15)' },
  whatsapp_message:   { icon: MessageSquare,  color: '#3fb98a', bg: 'rgba(63,185,138,0.15)' },
  whatsapp_sent:      { icon: MessageSquare,  color: '#7fdcb4', bg: 'rgba(127,220,180,0.12)' },
  email_received:     { icon: Mail,          color: '#c4b1ff', bg: 'rgba(196,177,255,0.15)' },
  email_sent:         { icon: Mail,          color: '#9cc0f0', bg: 'rgba(156,192,240,0.12)' },
  call:               { icon: Phone,         color: '#f0a04a', bg: 'rgba(240,160,74,0.15)' },
  viewing:            { icon: Eye,           color: '#f0a04a', bg: 'rgba(240,160,74,0.15)' },
  meeting:            { icon: Calendar,      color: '#c4b1ff', bg: 'rgba(196,177,255,0.15)' },
  note:               { icon: FileText,      color: '#8b96b0', bg: 'rgba(139,150,176,0.15)' },
  offer:              { icon: FileSignature, color: '#3fb98a', bg: 'rgba(63,185,138,0.15)' },
  stage_change:       { icon: TrendingUp,    color: '#c9a24b', bg: 'rgba(201,162,75,0.15)' },
  task_due:           { icon: Clock,         color: '#f0a04a', bg: 'rgba(240,160,74,0.15)' },
  followup_due:       { icon: Clock,         color: '#f0a04a', bg: 'rgba(240,160,74,0.15)' },
  document_received:  { icon: FileText,      color: '#c4b1ff', bg: 'rgba(196,177,255,0.15)' },
  invitation_sent:    { icon: Mail,          color: '#8b96b0', bg: 'rgba(139,150,176,0.15)' },
  member_joined:      { icon: UserPlus,      color: '#3fb98a', bg: 'rgba(63,185,138,0.15)' },
  activity:           { icon: Bell,          color: '#8b96b0', bg: 'rgba(139,150,176,0.15)' },
  general:            { icon: Bell,          color: '#8b96b0', bg: 'rgba(139,150,176,0.15)' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationCenter({ userEmail }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);
  const queryClient = useQueryClient();
  const knownIdsRef = useRef(new Set());

  // Fetch notifications for this user
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userEmail],
    queryFn: async () => {
      if (!userEmail) return [];
      const res = await base44.entities.Notification.filter(
        { recipient_email: userEmail },
        '-created_date',
        50,
      );
      return res || [];
    },
    enabled: !!userEmail,
    staleTime: 10_000,
  });

  // Track known IDs to detect genuinely new notifications
  useEffect(() => {
    if (notifications.length === 0) return;
    // On first load, just register all IDs without playing sound
    if (knownIdsRef.current.size === 0) {
      notifications.forEach(n => knownIdsRef.current.add(n.id));
    }
  }, [notifications]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!userEmail) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data?.recipient_email === userEmail) {
        // Only play sound if this is genuinely new (not already known)
        if (!knownIdsRef.current.has(event.data.id)) {
          knownIdsRef.current.add(event.data.id);
          playNotificationSound();
        }
        queryClient.invalidateQueries({ queryKey: ['notifications', userEmail] });
      }
    });
    return unsubscribe;
  }, [userEmail, queryClient]);

  // Unlock audio on first interaction + request notification permission
  useEffect(() => {
    unlockNotificationSound();
    requestNotificationPermission();
  }, []);

  // Update unread count
  useEffect(() => {
    const count = notifications.filter(n => !n.is_read).length;
    setUnreadCount(count);
  }, [notifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Notification.update(id, { is_read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userEmail] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(
        unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userEmail] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Notification.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userEmail] });
    },
  });

  const handleClick = useCallback((notif) => {
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.link) {
      window.location.href = notif.link;
    }
    setOpen(false);
  }, [markReadMutation]);

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative rounded-full flex items-center justify-center transition-all hover:scale-105"
        style={{
          width: '40px',
          height: '40px',
          background: open ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
          border: open ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.07)',
        }}
        title="Notifications"
      >
        <Bell
          className="w-[18px] h-[18px]"
          style={{ color: unreadCount > 0 ? '#c9a24b' : '#5d6680' }}
        />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center font-bold"
            style={{
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #f0a04a, #e8584a)',
              color: '#fff',
              fontSize: '10px',
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: '0 2px 8px rgba(232,88,74,0.5)',
              border: '2px solid rgba(10,14,26,0.9)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{
              background: '#f0a04a',
              animation: 'dmb-pulse 1.5s ease-in-out infinite',
            }}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: 'rgba(15,20,30,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(212,175,55,0.25)',
            zIndex: 9999,
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: '#c9a24b' }} />
              <span
                className="text-sm font-semibold"
                style={{ color: '#e8ecf6', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(212,175,55,0.15)',
                    color: '#c9a24b',
                    border: '1px solid rgba(212,175,55,0.3)',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: '#c9a24b' }}
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg transition-colors hover:bg-white/5"
              >
                <X className="w-4 h-4" style={{ color: '#5d6680' }} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell className="w-8 h-8 mb-2" style={{ color: '#3a4055' }} />
                <p className="text-sm" style={{ color: '#5d6680' }}>No notifications yet</p>
                <p className="text-xs mt-1" style={{ color: '#3a4055' }}>
                  You'll see alerts here for tasks, follow-ups, and lead assignments
                </p>
              </div>
            ) : (
              notifications.map(notif => {
                const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.general;
                const Icon = cfg.icon;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className="group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: notif.is_read ? 'transparent' : 'rgba(212,175,55,0.04)',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="shrink-0 rounded-full flex items-center justify-center"
                      style={{
                        width: '36px',
                        height: '36px',
                        background: cfg.bg,
                        border: `1px solid ${cfg.color}33`,
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!notif.is_read && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full"
                            style={{ background: '#c9a24b' }}
                          />
                        )}
                        <p
                          className="text-sm font-medium truncate"
                          style={{
                            color: notif.is_read ? 'rgba(255,255,255,0.7)' : '#e8ecf6',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {notif.title}
                        </p>
                      </div>
                      {notif.body && (
                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                        >
                          {notif.body}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px]" style={{ color: '#5d6680' }}>
                          {timeAgo(notif.created_date)}
                        </span>
                        {notif.link && (
                          <span className="text-[11px]" style={{ color: `${cfg.color}99` }}>
                            → View
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate(notif.id);
                          }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" style={{ color: '#5d6680' }} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(notif.id);
                        }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,100,100,0.5)' }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/10 shrink-0 text-center">
              <span className="text-[11px]" style={{ color: '#3a4055' }}>
                🔔 Sound enabled — you'll hear alerts in real time
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}