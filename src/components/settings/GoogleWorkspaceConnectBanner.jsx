import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calendar, Mail, HardDrive, CheckCircle2, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';

const CONNECTOR_ID = '6a4907061925b80b469ca3d5';

/**
 * GoogleWorkspaceConnectBanner
 * Shows a "Connect your Google account" prompt when the agent hasn't linked
 * Gmail / Calendar / Drive yet. Once connected, shows a compact connected state.
 *
 * Props:
 *  - variant: "card" (default, for Profile page) | "compact" (for landlord detail header)
 */
export default function GoogleWorkspaceConnectBanner({ variant = 'card', hideWhenConnected = false }) {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const checkConnection = async () => {
    try {
      const res = await base44.functions.invoke('checkGoogleWorkspaceConnection', {});
      setConnected(res.data?.connected === true);
      setEmail(res.data?.email || null);
    } catch {
      setConnected(false);
      setEmail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    base44.auth.isAuthenticated().then((authed) => {
      if (authed) checkConnection();
      else setLoading(false);
    });
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, '_blank');
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          checkConnection();
          setConnecting(false);
        }
      }, 600);
    } catch (err) {
      toast.error('Could not start Google connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await base44.connectors.disconnectAppUser(CONNECTOR_ID);
      setConnected(false);
      setEmail(null);
      toast.success('Google account disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Checking Google connection…
      </div>
    );
  }

  // ── Connected state ──────────────────────────────────────────────
  if (connected) {
    if (hideWhenConnected) return null;
    if (variant === 'compact') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Google connected{email ? ` · ${email}` : ''}
        </div>
      );
    }
    return (
      <div className="glass-card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Google Workspace Connected</p>
          <p className="text-xs text-muted-foreground truncate">
            {email ? email : 'Your Gmail, Calendar & Drive are linked.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-muted-foreground hover:text-red-400 gap-1.5">
          <Unplug className="w-3.5 h-3.5" /> Disconnect
        </Button>
      </div>
    );
  }

  // ── Not connected state ──────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <Button size="sm" onClick={handleConnect} disabled={connecting}
        className="gap-1.5 text-xs bg-accent text-accent-foreground hover:bg-accent/90">
        <Calendar className="w-3.5 h-3.5" />
        {connecting ? 'Connecting…' : 'Connect Google Calendar'}
      </Button>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Calendar className="w-6 h-6 text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Connect your Google account</p>
          <p className="text-xs text-muted-foreground mt-1">
            Link Gmail, Calendar and Drive so appointments sync to your calendar and emails flow into the CRM.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-16">
        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Calendar</span>
        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Gmail</span>
        <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Drive</span>
      </div>
      <div className="pl-16">
        <Button onClick={handleConnect} disabled={connecting}
          className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
          <Calendar className="w-4 h-4" />
          {connecting ? 'Connecting…' : 'Connect Google Account'}
        </Button>
      </div>
    </div>
  );
}