import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Settings, Wifi } from 'lucide-react';

export default function PFSettingsPanel() {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { connected, message, last_tested_at }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PFCredential.list().then((creds) => {
      if (creds && creds.length > 0) {
        const c = creds[0];
        setApiKey(c.api_key || '');
        setApiSecret(c.api_secret || '');
        setStatus({ connected: c.is_connected, message: c.test_message, tested_at: c.last_tested_at });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await base44.functions.invoke('savePFCredentials', { api_key: apiKey.trim(), api_secret: apiSecret.trim() });
      setStatus({ connected: res.data.is_connected, message: res.data.test_message, tested_at: new Date().toISOString() });
    } catch (err) {
      setStatus({ connected: false, message: err.message || 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading settings...</div>;

  return (
    <div className="max-w-xl space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4 text-accent" />
            Property Finder API Credentials
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your Property Finder API key and secret to connect your account. These are used for syncing leads and listings.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="Enter your PF API Key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-secret">API Secret</Label>
            <div className="relative">
              <Input
                id="api-secret"
                type={showSecret ? 'text' : 'password'}
                placeholder="Enter your PF API Secret"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !apiKey.trim() || !apiSecret.trim()}
            className="w-full gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {saving ? 'Testing & Saving...' : 'Save & Connect'}
          </Button>

          {status && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
              status.connected
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {status.connected
                ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
              <div>
                <p className="font-medium">{status.connected ? 'Connected' : 'Connection Failed'}</p>
                {status.message && <p className="text-xs mt-0.5 opacity-80">{status.message}</p>}
                {status.tested_at && (
                  <p className="text-xs mt-1 opacity-60">
                    Tested: {new Date(status.tested_at).toLocaleString('en-AE')}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>How to find your credentials:</strong> Log in to your Property Finder partner portal → Go to API Settings → Copy your API Key and API Secret. Credentials are stored securely and used only for syncing your leads and listings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}