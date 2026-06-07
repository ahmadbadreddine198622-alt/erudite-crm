import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function NotificationSettings({ notificationHook }) {
  const { permission, enabled, setEnabled, notifyAll, setNotifyAll, playSound, setPlaySound, requestPermission } = notificationHook;

  if (permission !== 'granted' && !enabled) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 gap-1.5 text-xs"
        onClick={requestPermission}
        style={{ color: 'rgba(255,255,255,0.7)' }}
      >
        <Bell className="w-3 h-3" />
        Enable notifications
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1.5 text-xs"
          style={{ color: enabled ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.5)' }}
        >
          {enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
          {enabled ? 'On' : 'Off'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" style={{ background: 'hsl(222 47% 11%)', borderColor: 'rgba(255,255,255,0.15)' }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>Desktop notifications</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Notify for all conversations</span>
            <Switch checked={notifyAll} onCheckedChange={setNotifyAll} disabled={!enabled} />
          </div>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {notifyAll ? 'All incoming messages' : 'Only assigned to you'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Play sound</span>
            <Switch checked={playSound} onCheckedChange={setPlaySound} disabled={!enabled} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}