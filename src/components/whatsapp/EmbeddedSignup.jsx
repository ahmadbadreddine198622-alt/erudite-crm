import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2, Phone, Wifi, RefreshCw, ArrowRight, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function EmbeddedSignup() {
  const [status, setStatus] = useState('checking'); // checking | connected | disconnected
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState('');

  const checkConfig = async () => {
    setChecking(true);
    setStatus('checking');
    try {
      const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'verify_config' });
      const data = res.data;
      if (data.configured) {
        setStatus('connected');
        setPhoneInfo(data);
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    }
    setChecking(false);
  };

  useEffect(() => { checkConfig(); }, []);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied!');
    setTimeout(() => setCopied(''), 2000);
  };

  const webhookUrl = `${window.location.origin}/api/functions/whatsappWebhook`;

  const qualityColor = { GREEN: 'text-green-600', YELLOW: 'text-yellow-500', RED: 'text-red-500' };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className={`border-2 transition-all ${status === 'connected' ? 'border-green-500/40 bg-green-500/5' : status === 'disconnected' ? 'border-red-500/30' : 'border-border'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {status === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {status === 'connected' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
              {status === 'disconnected' && <AlertCircle className="w-5 h-5 text-red-500" />}
              WhatsApp Business API Status
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={checkConfig} disabled={checking}>
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            {status === 'checking' && 'Verifying your WhatsApp credentials...'}
            {status === 'connected' && '✅ Connected and ready to send/receive messages.'}
            {status === 'disconnected' && 'Not connected. Configure your credentials below.'}
          </CardDescription>
        </CardHeader>

        {status === 'connected' && phoneInfo && (
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background border rounded-lg p-3 text-center">
                <Phone className="w-4 h-4 mx-auto mb-1 text-green-600" />
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="text-sm font-semibold">{phoneInfo.phone_number}</p>
              </div>
              <div className="bg-background border rounded-lg p-3 text-center">
                <Wifi className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <p className="text-xs text-muted-foreground">Display Name</p>
                <p className="text-sm font-semibold truncate">{phoneInfo.display_name}</p>
              </div>
              <div className="bg-background border rounded-lg p-3 text-center">
                <CheckCircle2 className={`w-4 h-4 mx-auto mb-1 ${qualityColor[phoneInfo.quality_rating] || 'text-muted-foreground'}`} />
                <p className="text-xs text-muted-foreground">Quality Rating</p>
                <p className={`text-sm font-semibold ${qualityColor[phoneInfo.quality_rating] || ''}`}>{phoneInfo.quality_rating || 'N/A'}</p>
              </div>
            </div>
            <Link to="/whatsapp">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                Open WhatsApp Inbox <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        )}
      </Card>

      {/* Manual Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Manual Configuration</CardTitle>
          <CardDescription className="text-xs">Set these secrets in your app Dashboard → Settings → Secrets, then click Verify.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              key: 'WHATSAPP_PHONE_NUMBER_ID',
              desc: 'Your Phone Number ID from Meta Business → WhatsApp → API Setup',
              example: '111463521666858',
            },
            {
              key: 'WHATSAPP_ACCESS_TOKEN',
              desc: 'Permanent System User token with whatsapp_business_messaging permission',
              example: 'EAABx...',
            },
            {
              key: 'WHATSAPP_VERIFY_TOKEN',
              desc: 'Any custom string you choose (used to verify the webhook)',
              example: 'my_secure_verify_token',
            },
          ].map(item => (
            <div key={item.key} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-semibold text-accent">{item.key}</code>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">e.g. {item.example}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}

          <Button className="w-full" onClick={checkConfig} disabled={checking}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Verify Connection
          </Button>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Webhook URL</CardTitle>
          <CardDescription className="text-xs">Add this in Meta → App → WhatsApp → Configuration → Webhook Callback URL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
            <code className="text-xs flex-1 break-all">{webhookUrl}</code>
            <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={() => copyToClipboard(webhookUrl, 'webhook')}>
              {copied === 'webhook' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}