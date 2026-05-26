import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle, Settings, Zap, FileText, Bot, TrendingUp,
  CheckCircle2, AlertCircle, Phone, Wifi, Copy, ExternalLink,
  Loader2, RefreshCw, Check, ArrowRight, Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import WorkflowBuilder from '@/components/whatsapp/WorkflowBuilder';
import AutomationDashboard from '@/components/whatsapp/AutomationDashboard';
import TemplateManager from '@/components/whatsapp/TemplateManager';
import WhatsAppSetupGuide from '@/components/whatsapp/WhatsAppSetupGuide';

const SETUP_STEPS = [
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

export default function WhatsAppHub() {
  const [activeTab, setActiveTab] = useState('overview');
  const [setupStatus, setSetupStatus] = useState('idle');
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [currentPhoneNumberId, setCurrentPhoneNumberId] = useState(null);

  const webhookUrl = `https://dubai-estate-pro.base44.app/functions/whatsappWebhook`;

  // Fetch connection status on mount
  React.useEffect(() => {
    const fetchConnection = async () => {
      try {
        const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'verify_config' });
        if (res.data?.configured) {
          setSetupStatus('connected');
          setPhoneInfo(res.data);
          setCurrentPhoneNumberId(res.data.phone_number);
        }
      } catch (err) {
        // Silent
      }
    };
    fetchConnection();
  }, []);

  const verifyConnection = async () => {
    setSetupStatus('checking');
    try {
      const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'verify_config' });
      const data = res.data;
      if (data.configured) {
        setSetupStatus('connected');
        setPhoneInfo(data);
        setCurrentPhoneNumberId(data.phone_number);
        toast.success('WhatsApp connected successfully!');
      } else {
        setSetupStatus('failed');
        toast.error(data.message || 'Connection failed. Check your secrets.');
      }
    } catch {
      setSetupStatus('failed');
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
            <MessageCircle className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Business Hub</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Complete WhatsApp integration for your CRM</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/whatsapp">
            <Button variant="outline" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Open Inbox
            </Button>
          </Link>
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            WhatsApp Web
          </a>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Setup</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Automation</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
                <MessageCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground mt-1">8 unread messages</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <Send className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                <Zap className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground mt-1">3 automated today</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Templates</CardTitle>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">4 favorites</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Connection Status
                </CardTitle>
                <CardDescription>Your WhatsApp Business API configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {setupStatus === 'connected' && phoneInfo ? (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-green-700">WhatsApp Connected ✅</p>
                        <p className="text-xs text-green-600">Your number is live and ready</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <Phone className="w-3.5 h-3.5 mx-auto mb-1 text-green-600" />
                        <p className="text-[10px] text-muted-foreground">Phone</p>
                        <p className="text-xs font-semibold">{phoneInfo.phone_number}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <Wifi className="w-3.5 h-3.5 mx-auto mb-1 text-blue-600" />
                        <p className="text-[10px] text-muted-foreground">Display Name</p>
                        <p className="text-xs font-semibold truncate">{phoneInfo.display_name}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-600" />
                        <p className="text-[10px] text-muted-foreground">Quality</p>
                        <p className="text-xs font-semibold">{phoneInfo.quality_rating || 'N/A'}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      {setupStatus === 'checking'
                        ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        : setupStatus === 'failed'
                        ? <AlertCircle className="w-5 h-5 text-red-500" />
                        : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      }
                      <div>
                        <p className="text-sm font-medium">
                          {setupStatus === 'checking' ? 'Checking...'
                            : setupStatus === 'failed' ? 'Connection failed'
                            : 'Not verified yet'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {setupStatus === 'failed'
                            ? 'Check your secrets in Base44 settings'
                            : 'Complete setup steps then click Verify'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <Button onClick={verifyConnection} disabled={setupStatus === 'checking'} className="flex-1 gap-2">
                    {setupStatus === 'checking'
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                      : <><CheckCircle2 className="w-4 h-4" /> Verify Connection</>
                    }
                  </Button>
                  <Button onClick={() => setActiveTab('setup')} variant="outline">
                    Manage Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common WhatsApp tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveTab('workflows')}>
                  <Zap className="w-4 h-4" />
                  Create New Workflow
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveTab('templates')}>
                  <FileText className="w-4 h-4" />
                  Manage Message Templates
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveTab('automation')}>
                  <Bot className="w-4 h-4" />
                  Configure Automation Rules
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                  <Link to="/whatsapp">
                    <MessageCircle className="w-4 h-4" />
                    Open Message Inbox
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-5">
          {/* Connection Status Card */}
          {setupStatus === 'connected' && phoneInfo ? (
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
            <Card className={`border-2 ${setupStatus === 'failed' ? 'border-red-400/40 bg-red-500/3' : 'border-border'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  {setupStatus === 'checking'
                    ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    : setupStatus === 'failed'
                    ? <AlertCircle className="w-5 h-5 text-red-500" />
                    : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                  }
                  <div>
                    <p className="font-medium text-sm">
                      {setupStatus === 'checking' ? 'Checking connection...'
                        : setupStatus === 'failed' ? 'Connection failed — check secrets below'
                        : 'Not verified yet'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {setupStatus === 'failed'
                        ? 'Make sure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set in Base44 secrets'
                        : 'Complete the steps below then click Verify'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phone Number ID */}
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
                <code className="text-sm font-mono font-semibold flex-1">
                  {currentPhoneNumberId || 'Loading...'}
                </code>
                <Badge variant="outline" className="text-xs shrink-0">WHATSAPP_PHONE_NUMBER_ID</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Setup Steps */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Setup Steps</CardTitle>
              <CardDescription className="text-xs">Follow these steps to get your access token and complete setup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {SETUP_STEPS.map((step) => (
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
            disabled={setupStatus === 'checking'}
          >
            {setupStatus === 'checking'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              : <><CheckCircle2 className="w-4 h-4" /> Verify Connection</>
            }
          </Button>

          {setupStatus === 'connected' && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={verifyConnection}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-check status
            </Button>
          )}
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows">
          <WorkflowBuilder />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation">
          <AutomationDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}