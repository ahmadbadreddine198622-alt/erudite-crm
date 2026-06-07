import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';

export default function useDesktopNotifications({ conversations, selectedConvId, onNotificationClick }) {
  const [permission, setPermission] = useState(Notification?.permission || 'default');
  const [enabled, setEnabled] = useState(false);
  const [notifyAll, setNotifyAll] = useState(false); // false = assigned only
  const [playSound, setPlaySound] = useState(true);
  const [lastMessageId, setLastMessageId] = useState(null);

  // Request permission
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Desktop notifications not supported in this browser');
      return;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === 'granted') {
      setEnabled(true);
      toast.success('Desktop notifications enabled');
    }
  };

  // Update tab title with unread count
  useEffect(() => {
    const totalUnread = conversations?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0;
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) WhatsApp — Erudite CRM`;
    } else {
      document.title = 'WhatsApp — Erudite CRM';
    }
  }, [conversations]);

  // Subscribe to new messages
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    const unsub = base44.entities.WhatsAppMessage.subscribe((event) => {
      // Skip if this is an outgoing message or duplicate
      if (event.data?.direction === 'outbound' || event.data?.direction === 'outgoing') return;
      if (event.data?.id === lastMessageId) return;
      
      setLastMessageId(event.data?.id);

      // Check if we should notify
      const conv = conversations?.find(c => c.id === event.data?.conversation_id);
      if (!conv) return;

      // Filter by assignment if needed
      const currentUser = base44.auth.me();
      if (!notifyAll && conv.assigned_agent_email !== currentUser?.email) return;

      // Don't notify if this conversation is currently open and tab is focused
      if (event.data?.conversation_id === selectedConvId && !document.hidden) return;

      const senderName = conv.wa_display_name || conv.wa_phone_e164 || 'Unknown';
      const preview = (event.data?.body || '').slice(0, 80);

      // Show notification
      new Notification(senderName, {
        body: preview,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: event.data?.id,
      });

      // Play sound
      if (playSound) {
        const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
        audio.play().catch(() => {});
      }

      // Click handler
      const notification = new Notification(senderName, {
        body: preview,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: event.data?.id,
      });

      notification.onclick = () => {
        window.focus();
        onNotificationClick?.(event.data?.conversation_id);
        notification.close();
      };
    });

    return () => unsub();
  }, [enabled, permission, notifyAll, playSound, conversations, selectedConvId, lastMessageId]);

  return {
    permission,
    enabled,
    setEnabled,
    notifyAll,
    setNotifyAll,
    playSound,
    setPlaySound,
    requestPermission,
  };
}

export function NotificationSettings({ notificationHook }) {
  const { permission, enabled, setEnabled, notifyAll, setNotifyAll, playSound, setPlaySound, requestPermission } = notificationHook;

  if (permission !== 'granted' && !enabled) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
        <BellOff className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1">Desktop notifications disabled</span>
        <Button size="sm" variant="outline" onClick={requestPermission} className="h-7 text-xs">
          <Bell className="w-3 h-3 mr-1" /> Enable
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2 rounded-lg border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Desktop Notifications</span>
        <Bell className="w-3.5 h-3.5 text-green-500" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Notify me</span>
        <select
          value={notifyAll ? 'all' : 'assigned'}
          onChange={(e) => setNotifyAll(e.target.value === 'all')}
          className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20"
        >
          <option value="assigned">My conversations only</option>
          <option value="all">All conversations</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Play sound</span>
        <Switch checked={playSound} onCheckedChange={setPlaySound} className="scale-75" />
      </div>
    </div>
  );
}