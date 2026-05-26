import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2, Phone, Wifi, WifiOff, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function EmbeddedSignup() {
  const [status, setStatus] = useState('checking'); // checking | connected | disconnected | error
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkConfig = async () => {
    setStatus('checking');
    const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'verify_config' });
    const data = res.data;
    if (data.configured) {
      setStatus('connected');
      setPhoneInfo(data);
    } else {
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    checkConfig();
  }, []);

  const launchEmbeddedSignup = () => {
    // Load Facebook SDK and launch embedded signup
    if (typeof window.FB === 'undefined') {
      toast.error('Facebook SDK not loaded. Please configure META_APP_ID first.');
      return;
    }

    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          handleTokenExchange(response.authResponse.code);
        } else {
          toast.error('Signup cancelled or failed');
        }
      },
      {
        config_id: '<YOUR_CONFIG_ID>',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '2',
        },
      }
    );
  };

  const handleTokenExchange = async (code) => {
    setLoading(true);
    const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'exchange_token', code });
    const data = res.data;
    if (data.success) {
      toast.success('WhatsApp Business connected! Save the access token in your app secrets.');
      setStatus('connected');
    } else if (data.missing_secrets) {
      toast.error('Set META_APP_ID and META_APP_SECRET in app settings first.');
    } else {
      toast.error(data.error || 'Token exchange failed');
    }
    setLoading(false);
  };

  const qualityColor = {
    GREEN: 'text-green-600',
    YELLOW: 'text-yellow-600',
    RED: 'text-red-600',
  };

  return (
    <div className="space-y-4">
      {/* Connection Status Card */}
      <Card className={`border-2 ${status === 'connected' ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {status === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {status === 'connected' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              {status === 'disconnected' && <WifiOff className="w-4 h-4 text-red-500" />}
              {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
              WhatsApp Business API
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={checkConfig}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <CardDescription>
            {status === 'checking' && 'Checking connection...'}
            {status === 'connected' && 'Your WhatsApp Business account is connected and ready.'}
            {status === 'disconnected' && 'Not connected. Set up your WhatsApp Business API credentials.'}
          </CardDescription>
        </CardHeader>

        {status === 'connected' && phoneInfo && (
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border rounded-lg p-3 text-center">
                <Phone className="w-4 h-4 mx-auto mb-1 text-green-600" />
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-semibold">{phoneInfo.phone_number}</p>
              </div>
              <div className="bg-card border rounded-lg p-3 text-center">
                <Wifi className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <p className="text-xs text-muted-foreground">Display Name</p>
                <p className="text-sm font-semibold truncate">{phoneInfo.display_name}</p>
              </div>
              <div className="bg-card border rounded-lg p-3 text-center">
                <CheckCircle2 className={`w-4 h-4 mx-auto mb-1 ${qualityColor[phoneInfo.quality_rating] || 'text-muted-foreground'}`} />
                <p className="text-xs text-muted-foreground">Quality</p>
                <p className={`text-sm font-semibold ${qualityColor[phoneInfo.quality_rating] || ''}`}>{phoneInfo.quality_rating || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Setup Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Option A: Embedded Signup */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">Recommended</Badge>
              <h3 className="font-semibold text-sm">Meta Embedded Signup</h3>
            </div>
            <p className="text-xs text-muted-foreground">Connect directly via Meta's official onboarding flow. Requires META_APP_ID and META_APP_SECRET in app secrets.</p>
            <Button
              onClick={launchEmbeddedSignup}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Connect via Meta (Embedded Signup)
            </Button>
          </div>

          {/* Option B: Manual */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Manual Configuration</h3>
            <p className="text-xs text-muted-foreground">Already have your WhatsApp Business API credentials? Set these secrets in your app settings:</p>
            <div className="space-y-2">
              {[
                { key: 'WHATSAPP_PHONE_NUMBER_ID', desc: 'From Meta Business → WhatsApp → API Setup' },
                { key: 'WHATSAPP_ACCESS_TOKEN', desc: 'Permanent token from System User' },
                { key: 'WHATSAPP_VERIFY_TOKEN', desc: 'Any custom string you choose' },
              ].map(item => (
                <div key={item.key} className="flex items-start gap-2 bg-muted/40 rounded p-2">
                  <code className="text-xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">{item.key}</code>
                  <span className="text-xs text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Meta WhatsApp Cloud API Docs
            </a>
          </div>

          {/* Webhook URL */}
          <div className="border border-dashed rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Webhook URL</h3>
            <p className="text-xs text-muted-foreground mb-2">Add this to Meta → App → WhatsApp → Configuration → Webhook:</p>
            <code className="block text-xs bg-muted p-2 rounded break-all">
              {window.location.origin}/api/functions/whatsappWebhook
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}