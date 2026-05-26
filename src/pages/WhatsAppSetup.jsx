import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, AlertCircle, Loader2, Phone, Wifi, RefreshCw,
  ArrowRight, Copy, Check, MessageCircle, ExternalLink, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import WorkflowBuilder from '@/components/whatsapp/WorkflowBuilder';

const STEPS = [
  {
    number: 1,
    title: 'Go to Meta for Developers',
    description: 'Open your app at developers.facebook.com',
    link: 'https://developers.facebook.com',
    linkLabel: 'Open Meta Developers →',
  },
  {
    number: 2,
    title: 'Find Your Access Token',
    description: 'Left menu → WhatsApp → API Setup → scroll to "Step 2" → copy the Temporary access token. For a permanent token: go to Business Settings → System Users → create one → Generate Token → enable whatsapp_business_messaging.',
  },
  {
    number: 3,
    title: 'Set a Verify Token',
    description: 'This is any custom string you choose (like a password). Example: erudite_verify_2024. You\'ll use this same string in Meta\'s webhook settings.',
  },
  {
    number: 4,
    title: 'Save Both Secrets in Base44',
    description: 'Go to Base44 Dashboard → Settings → Secrets and add WHATSAPP_ACCESS_TOKEN and WHATSAPP_VERIFY_TOKEN.',
  },
  {
    number: 5,
    title: 'Configure Webhook in Meta',
    description: 'Meta Developers → Your App → WhatsApp → Configuration → Webhook. Paste the Callback URL below and your verify token. Subscribe to "messages".',
  },
];

export default function WhatsAppSetup() {
  const [status, setStatus] = useState('idle'); // idle | checking | connected | failed
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('setup'); // setup | workflows

  const webhookUrl = `https://dubai-estate-pro.base44.app/functions/whatsappWebhook`;

  const verifyConnection = async () => {
    setStatus('checking');
    try {
      const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'verify_config' });
      const data = res.data;
      if (data.configured) {
        setStatus('connected');
        setPhoneInfo(data);
        toast.success('WhatsApp connected successfully!');
      } else {
        setStatus('failed');
        toast.error(data.message || 'Connection failed. Check your secrets.');
      }
    } catch {
      setStatus('failed');
      toast.error('Verification failed. Make sure your secrets are set.');
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Business Setup</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Connect your personal WhatsApp Business number to your CRM</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b pb-0">
        {['setup', 'workflows'].map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {key === 'setup' ? 'Setup & Connection' : 'AI Workflows'}
          </button>
        ))}
      </div>

      {activeTab === 'setup' && (
        <div className="space-y-5">

          {/* Connection Status */}
          {status === 'connected' && phoneInfo ? (
            <Card className="border-2 border-green-500/40 bg-green-500/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-700">WhatsApp Connected ✅</p>
                    <p className="text-xs text-green-600">Your number is live and ready to receive messages</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white border rounded-lg p-3 text-center">
                    <Phone className="w-4 h-4 mx-auto mb-1 text-green-600" />
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-semibold">{phoneInfo.phone_number}</p>
                  </div>
                  <div className="bg-white border rounded-lg p-3 text-center">
                    <Wifi className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                    <p className="text-xs text-muted-foreground">Display Name</p>
                    <p className="text-sm font-semibold truncate">{phoneInfo.display_name}</p>
                  </div>
                  <div className="bg-white border rounded-lg p-3 text-center">
                    <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    <p className="text-xs text-muted-foreground">Quality</p>
                    <p className="text-sm font-semibold">{phoneInfo.quality_rating || 'N/A'}</p>
                  </div>
                </div>
                <Link to="/whatsapp">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-11">
                    <MessageCircle className="w-4 h-4" />
                    Open WhatsApp Inbox — View Your Chats
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className={`border-2 ${status === 'failed' ? 'border-red-400/40 bg-red-500/3' : 'border-border'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  {status === 'checking'
                    ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    : status === 'failed'
                    ? <AlertCircle className="w-5 h-5 text-red-500" />
                    : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                  }
                  <div>
                    <p className="font-medium text-sm">
                      {status === 'checking' ? 'Checking connection...'
                        : status === 'failed' ? 'Connection failed — check secrets below'
                        : 'Not verified yet'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status === 'failed'
                        ? 'Make sure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set in Base44 secrets'
                        : 'Complete the steps below then click Verify'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phone Number ID - pre-filled */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">Already Set</Badge>
                Your Phone Number ID
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <code className="text-sm font-mono font-semibold flex-1">111463521666858</code>
                <Badge variant="outline" className="text-xs shrink-0">WHATSAPP_PHONE_NUMBER_ID</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Step by step guide */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Setup Steps</CardTitle>
              <CardDescription className="text-xs">Follow these steps to get your access token and complete setup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {STEPS.map((step) => (
                <div key={step.number} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                    {step.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                    {step.link && (
                      <a href={step.link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                        <ExternalLink className="w-3 h-3" /> {step.linkLabel}
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {/* Webhook URL */}
              <div className="mt-2 border rounded-lg p-3 bg-muted/30 space-y-2">
                <p className="text-xs font-medium">Your Webhook Callback URL (for Step 5):</p>
                <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-2">
                  <code className="text-xs flex-1 break-all text-green-700">{webhookUrl}</code>
                  <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={copyWebhook}>
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Subscribe to webhook field: <code className="bg-muted px-1 rounded">messages</code></p>
              </div>
            </CardContent>
          </Card>

          {/* Verify Button */}
          <Button
            className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 text-base gap-2"
            onClick={verifyConnection}
            disabled={status === 'checking'}
          >
            {status === 'checking'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              : <><CheckCircle2 className="w-4 h-4" /> Verify Connection</>
            }
          </Button>

          {status === 'connected' && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={verifyConnection}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-check status
            </Button>
          )}
        </div>
      )}

      {activeTab === 'workflows' && (
        <WorkflowBuilder />
      )}
    </div>
  );
}

// Small inline icon component to avoid extra import
function Settings2({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}