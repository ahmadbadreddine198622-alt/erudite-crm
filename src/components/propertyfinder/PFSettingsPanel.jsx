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
  const [secretChanged, setSecretChanged] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingHasSecret, setExistingHasSecret] = useState(false);

  useEffect(() => {
    base44.functions.invoke('getPFCredentials', {}).then((res) => {
      const d = res.data;
      if (d && d.found) {
        setApiKey(d.api_key || '');
        setExistingHasSecret(d.has_secret || false);
        if (d.is_connected !== undefined) {
          setStatus({ connected: d.is_connected, message: d.test_message, tested_at: d.last_tested_at });
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) return;
    if (!existingHasSecret && !apiSecret.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const payload = { api_key: apiKey.trim() };
      if (secretChanged && apiSecret.trim()) payload.api_secret = apiSecret.trim();
      const res = await base44.functions.invoke('savePFCredentials', payload);
      setStatus({ connected: res.data.is_connected, message: res.data.test_message, tested_at: new Date().toISOString() });
      setSecretChanged(false);
      setExistingHasSecret(true);
      setApiSecret('');
    } catch (err) {
      setStatus({ connected: false, message: err.message || 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
    </div>
  );

  return (
    <div className="max-w-xl space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4 text-accent" />
            Property Finder API Credentials
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Your API key and secret are used to sync leads and listings from Property Finder.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Connection status badge */}
          {status && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              status.connected ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {status.connected
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertCircle className="w-4 h-4 shrink-0" />}
              {status.connected ? 'Connected to Property Finder' : 'Not connected'}
              {status.tested_at && (
                <span className="ml-auto text-xs opacity-60">
                  {new Date(status.tested_at).toLocaleString('en-AE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* API Key */}
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

          {/* API Secret */}
          <div className="space-y-1.5">
            <Label htmlFor="api-secret">
              API Secret
              {existingHasSecret && !secretChanged && (
                <span className="ml-2 text-xs text-green-600 font-normal">✓ Saved</span>
              )}
            </Label>
            <Input
              id="api-secret"
              type="password"
              placeholder={existingHasSecret && !secretChanged ? '••••••••  (leave blank to keep existing)' : 'Enter your PF API Secret'}
              value={apiSecret}
              onChange={e => { setApiSecret(e.target.value); setSecretChanged(true); }}
              className="font-mono text-sm"
            />
            {existingHasSecret && !secretChanged && (
              <p className="text-xs text-muted-foreground">Secret is saved. Leave blank to keep it, or type a new one to replace.</p>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !apiKey.trim() || (!existingHasSecret && !apiSecret.trim())}
            className="w-full gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {saving ? 'Testing & Saving...' : 'Save & Connect'}
          </Button>

          {status && status.message && (
            <p className={`text-xs text-center ${status.connected ? 'text-green-600' : 'text-red-600'}`}>
              {status.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Where to find your credentials:</strong> Log in to your Property Finder partner portal → API Settings → Copy your API Key and Secret. Credentials are stored securely and used only for syncing your leads and listings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}