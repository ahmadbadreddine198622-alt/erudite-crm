import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Loader2, LogIn, Eye, EyeOff, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function PFConnectionBanner({ onConnected }) {
  const [status, setStatus] = useState(null); // null=loading, {connected, message, api_key}
  const [showLogin, setShowLogin] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setStatus(null);
    try {
      const res = await base44.functions.invoke('getPFCredentials', {});
      const d = res.data;
      setStatus({ connected: d.is_connected, message: d.test_message, api_key: d.api_key, found: d.found });
      if (d.is_connected) onConnected && onConnected();
    } catch {
      setStatus({ connected: false, message: 'Could not fetch connection status', found: false });
    }
  }

  async function handleSave() {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await base44.functions.invoke('savePFCredentials', { api_key: apiKey.trim(), api_secret: apiSecret.trim() });
      if (res.data.is_connected) {
        setStatus({ connected: true, message: res.data.test_message, found: true });
        setShowLogin(false);
        setApiKey(''); setApiSecret('');
        onConnected && onConnected();
      } else {
        setSaveError(res.data.test_message || 'Authentication failed. Check your credentials.');
        setStatus({ connected: false, message: res.data.test_message, found: true });
      }
    } catch (err) {
      setSaveError(err.message || 'Connection failed');
    } finally {
      setSaving(false);
    }
  }

  if (status === null) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking connection...
    </div>
  );

  // Connected — show small status bar
  if (status.connected) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        <span className="text-sm font-medium text-green-800">Connected to Property Finder</span>
        {status.api_key && <span className="text-xs text-green-600 font-mono">Key: {status.api_key.substring(0, 8)}•••</span>}
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-green-700 hover:text-green-900 hover:bg-green-100 h-7" onClick={() => { setShowLogin(true); }}>
          <RefreshCw className="w-3 h-3" /> Reconnect
        </Button>
        {showLogin && (
          <div className="absolute z-50 mt-12 inset-x-0 mx-auto max-w-md" />
        )}
      </div>
    );
  }

  // Not connected — show login card
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="py-4 px-5">
        {!showLogin ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Not connected to Property Finder</p>
                <p className="text-xs text-amber-700">{status.message || 'Connect your account to sync leads and manage listings.'}</p>
              </div>
            </div>
            <Button onClick={() => setShowLogin(true)} className="gap-2 ml-auto bg-amber-500 hover:bg-amber-600 text-white">
              <LogIn className="w-4 h-4" /> Login to Property Finder
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-md">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Connect your Property Finder Account</p>
              <button onClick={() => { setShowLogin(false); setSaveError(null); }} className="text-muted-foreground hover:text-foreground text-xs underline">Cancel</button>
            </div>
            <p className="text-xs text-muted-foreground">Enter your API credentials from the Property Finder partner portal. Go to: Partner Portal → API Settings.</p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">API Key</Label>
                <div className="relative mt-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="Your PF API Key"
                    className="pr-10 font-mono text-sm h-8"
                  />
                  <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs">API Secret</Label>
                <Input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="Your PF API Secret" className="font-mono text-sm h-8 mt-1" />
              </div>
            </div>
            {saveError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{saveError}</p>}
            <Button onClick={handleSave} disabled={saving || !apiKey.trim() || !apiSecret.trim()} className="w-full gap-2 h-8">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              {saving ? 'Connecting...' : 'Connect Account'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}