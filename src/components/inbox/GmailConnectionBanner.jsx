import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function GmailConnectionBanner({ emailCount, onSynced }) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('handleGmailWebhook', {});
      setLastSynced(new Date());
      toast.success('Gmail synced successfully');
      onSynced?.();
    } catch (err) {
      toast.error('Sync failed — check your Gmail connection');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border-b border-border bg-emerald-500/5">
      {/* Collapsed bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-foreground">Gmail Connected</span>
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
            Active
          </Badge>
          {emailCount > 0 && (
            <span className="text-xs text-muted-foreground">{emailCount} emails synced</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSynced && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Synced {lastSynced.toLocaleTimeString()}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 gap-1 text-xs"
            onClick={e => { e.stopPropagation(); handleSync(); }}
            disabled={syncing}
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-border/60 pt-3 bg-background/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Gmail Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your Gmail is connected via OAuth. Emails from leads are automatically synced to this inbox.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Sync Mode</p>
              <p className="text-sm font-medium">Read-only (Gmail API)</p>
            </div>
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Emails in Inbox</p>
              <p className="text-sm font-medium">{emailCount}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Emails are synced via Gmail webhook. Click <strong>Sync</strong> to pull the latest emails manually.
              New emails from leads are linked automatically.
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}