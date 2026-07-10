import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Settings, Wifi, Zap, FlaskConical, Globe } from 'lucide-react';

export default function PFSettingsPanel() {
  const [activeEnv, setActiveEnv] = useState('sandbox');

  // Sandbox credentials
  const [sandboxKey, setSandboxKey] = useState('');
  const [sandboxSecret, setSandboxSecret] = useState('');
  const [sandboxSecretChanged, setSandboxSecretChanged] = useState(false);
  const [hasSandboxSecret, setHasSandboxSecret] = useState(false);
  const [sandboxConnected, setSandboxConnected] = useState(false);

  // Production credentials
  const [prodKey, setProdKey] = useState('');
  const [prodSecret, setProdSecret] = useState('');
  const [prodSecretChanged, setProdSecretChanged] = useState(false);
  const [hasProdSecret, setHasProdSecret] = useState(false);
  const [prodConnected, setProdConnected] = useState(false);

  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('getPFCredentials', {}).then((res) => {
      const d = res.data;
      if (d && d.found) {
        setActiveEnv(d.active_environment || 'sandbox');
        // Sandbox
        setSandboxKey(d.sandbox_api_key || '');
        setHasSandboxSecret(d.has_sandbox_secret || false);
        setSandboxConnected(d.sandbox_is_connected || false);
        // Production
        setProdKey(d.api_key || '');
        setHasProdSecret(d.has_secret || false);
        setProdConnected(d.is_connected || false);
        // Status
        if (d.test_message) {
          setStatus({ connected: d.active_environment === 'sandbox' ? d.sandbox_is_connected : d.is_connected, message: d.test_message, tested_at: d.last_tested_at });
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const isSandbox = activeEnv === 'sandbox';
  const apiKey = isSandbox ? sandboxKey : prodKey;
  const setApiKey = isSandbox ? setSandboxKey : setProdKey;
  const apiSecret = isSandbox ? sandboxSecret : prodSecret;
  const setApiSecret = isSandbox ? setSandboxSecret : setProdSecret;
  const secretChanged = isSandbox ? sandboxSecretChanged : prodSecretChanged;
  const setSecretChanged = isSandbox ? setSandboxSecretChanged : setProdSecretChanged;
  const hasSecret = isSandbox ? hasSandboxSecret : hasProdSecret;
  const isConnected = isSandbox ? sandboxConnected : prodConnected;

  async function handleSave() {
    if (!apiKey.trim()) return;
    if (!hasSecret && !apiSecret.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        environment: activeEnv,
        api_key: apiKey.trim(),
        api_secret: secretChanged && apiSecret.trim() ? apiSecret.trim() : undefined,
      };
      // If no new secret and one already exists, we need to re-send the existing one
      // savePFCredentials requires api_secret — fetch from backend if not changed
      if (!payload.api_secret && hasSecret) {
        // Pass a sentinel to re-use existing — handle on backend by not passing api_secret
        delete payload.api_secret;
        payload.keep_existing_secret = true;
      }
      const res = await base44.functions.invoke('savePFCredentials', payload);
      const d = res.data;
      setStatus({ connected: d.is_connected, message: d.test_message, tested_at: new Date().toISOString() });
      if (isSandbox) { setSandboxConnected(d.is_connected); setHasSandboxSecret(true); setSandboxSecret(''); setSandboxSecretChanged(false); }
      else { setProdConnected(d.is_connected); setHasProdSecret(true); setProdSecret(''); setProdSecretChanged(false); }
    } catch (err) {
      setStatus({ connected: false, message: err.message || 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setStatus(null);
    try {
      const res = await base44.functions.invoke('pfTestConnection', { environment: activeEnv });
      const d = res.data || res;
      const connected = d.connected || false;
      setStatus({ connected, message: d.message || d.error || 'Unknown response', tested_at: d.tested_at || new Date().toISOString() });
      if (isSandbox) setSandboxConnected(connected);
      else setProdConnected(connected);
    } catch (err) {
      setStatus({ connected: false, message: err.message || 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return (
    <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
    </div>
  );

  return (
    <div className="max-w-xl space-y-5">
      {/* Environment toggle */}
      <div className="flex gap-2 p-1 rounded-xl bg-muted/30 border border-border">
        <button
          onClick={() => { setActiveEnv('sandbox'); setStatus(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeEnv === 'sandbox'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          Sandbox
          {sandboxConnected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1" />}
        </button>
        <button
          onClick={() => { setActiveEnv('production'); setStatus(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeEnv === 'production'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="w-4 h-4" />
          Production
          {prodConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />}
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {isSandbox ? <FlaskConical className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
            {isSandbox ? 'Sandbox' : 'Production'} API Credentials
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSandbox
              ? 'Sandbox credentials — safe for testing. Base URL: sandbox.atlas.propertyfinder.com'
              : 'Production credentials — live API. Base URL: atlas.propertyfinder.com'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {status && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              status.connected
                ? 'bg-green-50/10 text-green-400 border border-green-500/30'
                : 'bg-red-50/10 text-red-400 border border-red-500/30'
            }`}>
              {status.connected ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {status.message}
              {status.tested_at && (
                <span className="ml-auto text-xs opacity-60">
                  {new Date(status.tested_at).toLocaleString('en-AE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder={`Enter your ${isSandbox ? 'Sandbox' : 'Production'} API Key`}
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
            <Label htmlFor="api-secret">
              API Secret
              {hasSecret && !secretChanged && <span className="ml-2 text-xs text-green-500 font-normal">✓ Saved</span>}
            </Label>
            <Input
              id="api-secret"
              type="password"
              placeholder={hasSecret && !secretChanged ? '•••••••• (leave blank to keep existing)' : `Enter your ${isSandbox ? 'Sandbox' : 'Production'} API Secret`}
              value={apiSecret}
              onChange={e => { setApiSecret(e.target.value); setSecretChanged(true); }}
              className="font-mono text-sm"
            />
            {hasSecret && !secretChanged && (
              <p className="text-xs text-muted-foreground">Secret is saved. Leave blank to keep it, or type a new one to replace.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !apiKey.trim() || (!hasSecret && !apiSecret.trim())}
              className="flex-1 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save & Connect'}
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={testing || !isConnected && !hasSecret}
              variant="outline"
              className="flex-1 gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isSandbox && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-amber-400/80 leading-relaxed">
              <strong>🧪 Sandbox Mode</strong> — All API calls go to <code className="text-xs">sandbox.atlas.propertyfinder.com</code>. 
              Credits: 10,000 (expires 26 Aug 2026). Test everything here before switching to Production.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}