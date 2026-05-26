import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, LogIn, Eye, EyeOff, Wifi, WifiOff, RefreshCw, X, Building2 } from 'lucide-react';

export default function PFConnectionBanner({ onConnected }) {
  const [status, setStatus] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => { loadStatus(); }, []);

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

  async function handleLogin() {
    if (!username.trim() || !password.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await base44.functions.invoke('savePFCredentials', {
        api_key: username.trim(),
        api_secret: password.trim(),
      });
      if (res.data.is_connected) {
        setStatus({ connected: true, message: res.data.test_message, found: true });
        setShowLogin(false);
        setUsername(''); setPassword('');
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

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin();
  }

  if (status === null) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking connection...
    </div>
  );

  return (
    <>
      {/* Status bar */}
      {status.connected ? (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm font-medium text-green-800">Connected to Property Finder</span>
          {status.api_key && (
            <span className="text-xs text-green-600 font-mono hidden sm:inline">
              {status.api_key.substring(0, 6)}•••
            </span>
          )}
          <Button
            variant="ghost" size="sm"
            className="ml-auto gap-1.5 text-green-700 hover:text-green-900 hover:bg-green-100 h-7"
            onClick={() => setShowLogin(true)}
          >
            <RefreshCw className="w-3 h-3" /> Reconnect
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">Not connected to Property Finder</p>
              <p className="text-xs text-amber-700">{status.message || 'Login to sync leads and manage listings.'}</p>
            </div>
          </div>
          <Button onClick={() => setShowLogin(true)} className="gap-2 ml-auto bg-amber-500 hover:bg-amber-600 text-white">
            <LogIn className="w-4 h-4" /> Login to Property Finder
          </Button>
        </div>
      )}

      {/* Login modal overlay */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#1a2744] to-[#2d4a8a] px-8 py-8 text-center relative">
              <button
                onClick={() => { setShowLogin(false); setSaveError(null); setUsername(''); setPassword(''); }}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-white font-bold text-xl">Property Finder</h2>
              <p className="text-white/70 text-sm mt-1">Sign in to your account</p>
            </div>

            {/* Form */}
            <div className="px-8 py-7 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="pf-username" className="text-sm font-medium text-gray-700">
                  Email / Username
                </Label>
                <Input
                  id="pf-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="your@email.com"
                  className="h-11 text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pf-password" className="text-sm font-medium text-gray-700">
                  Password / API Secret
                </Label>
                <div className="relative">
                  <Input
                    id="pf-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="••••••••••••"
                    className="h-11 text-sm pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  {saveError}
                </div>
              )}

              <Button
                onClick={handleLogin}
                disabled={saving || !username.trim() || !password.trim()}
                className="w-full h-11 bg-[#1a2744] hover:bg-[#2d4a8a] text-white gap-2 font-semibold text-sm rounded-xl"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                ) : (
                  <><Wifi className="w-4 h-4" /> Sign In</>
                )}
              </Button>

              <p className="text-center text-xs text-gray-400">
                Use your Property Finder Partner Portal credentials
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}