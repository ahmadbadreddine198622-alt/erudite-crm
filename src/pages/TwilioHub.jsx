import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone, Settings, RefreshCw, Loader2, CheckCircle2, XCircle,
  PhoneCall, PhoneIncoming, FileAudio, Clock, ExternalLink, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import CallLogPanel from '@/components/twilio/CallLogPanel';

function PhoneNumberCard({ number }) {
  const caps = number.capabilities || {};
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
        <Phone className="w-5 h-5 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{number.phone_number}</p>
        <p className="text-xs text-muted-foreground">{number.friendly_name}</p>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {caps.voice && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/25 border">Voice</Badge>}
        {caps.SMS && <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/25 border">SMS</Badge>}
        {caps.MMS && <Badge className="text-[10px] bg-purple-500/15 text-purple-400 border-purple-500/25 border">MMS</Badge>}
      </div>
    </div>
  );
}

function ConnectionSetup({ onSaved, existingCredential }) {
  const [form, setForm] = useState({
    account_sid: existingCredential?.account_sid || '',
    auth_token: existingCredential?.auth_token || '',
    voice_number: existingCredential?.voice_number || '',
    sms_number: existingCredential?.sms_number || '',
    agent_phone: existingCredential?.agent_phone || '',
    label: existingCredential?.label || 'Main Account',
    record_calls: existingCredential?.record_calls ?? true,
    api_key_sid: existingCredential?.api_key_sid || '',
    api_key_secret: existingCredential?.api_key_secret || '',
    twiml_app_sid: existingCredential?.twiml_app_sid || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.account_sid || !form.auth_token) {
      toast.error('Account SID and Auth Token are required');
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveTwilioCredential', form);
      if (res.data?.ok) {
        toast.success('Twilio connected successfully!');
        onSaved();
      } else {
        toast.error(res.data?.error || 'Failed to save');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Connection failed — check your credentials');
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, placeholder, type = 'text') => (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="h-9"
      />
    </div>
  );

  return (
    <Card className="liquid-glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" /> Connect Twilio Account
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Enter your Twilio credentials to enable click-to-call, SMS, and call recording in the CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('account_sid', 'Account SID *', 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')}
          {field('auth_token', 'Auth Token *', 'Your Twilio Auth Token', 'password')}
          {field('voice_number', 'Default Voice Number (CallerID)', '+971XXXXXXXXX')}
          {field('sms_number', 'Default SMS Number', '+971XXXXXXXXX')}
          {field('label', 'Label', 'e.g. Dubai Office')}
        </div>

        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <p className="text-xs font-semibold text-emerald-300">📞 Your Real Mobile Number (REQUIRED for calls to work)</p>
          <p className="text-[11px] text-muted-foreground">
            When you click Call, Twilio rings <strong>your personal mobile phone</strong> first. When you pick up, it immediately dials the customer and bridges you together — full two-way audio.
          </p>
          {form.agent_phone && form.agent_phone === form.voice_number && (
            <div className="rounded-lg px-3 py-2 text-xs font-semibold text-red-300" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}>
              ⚠️ Agent phone is the same as your Twilio number! Calls will NOT work. Enter your personal mobile (e.g. +971501234567).
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('agent_phone', 'Your Personal Mobile Number', '+971XXXXXXXXX (e.g. your UAE mobile)')}
          </div>
        </div>

        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-xs font-semibold text-indigo-300">🎧 Browser Dialer (required for in-browser audio calls)</p>

          {/* Critical warning about Standard API key */}
          <div className="rounded-lg px-3 py-2.5 space-y-1" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)' }}>
            <p className="text-xs font-bold text-red-300">⚠️ IMPORTANT: You must use a Standard API key — NOT a Restricted key</p>
            <p className="text-[11px] text-red-200/70">
              Restricted API keys cannot sign Voice tokens and will cause <strong>ConnectionError 53000</strong> in the browser dialer.
              When creating the API key, select <strong>"Standard"</strong> key type (not Restricted).
            </p>
            <a
              href="https://console.twilio.com/us1/account/keys-credentials/api-keys/create"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-red-300 underline font-medium mt-1"
            >
              Create a Standard API Key →
            </a>
          </div>

          <p className="text-[11px] text-muted-foreground mb-2">
            Create a <strong>Standard</strong> API Key at <a href="https://console.twilio.com/us1/account/keys-credentials/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent underline">Twilio Console → API Keys</a> and a TwiML App at <a href="https://console.twilio.com/us1/develop/voice/manage/twiml-apps" target="_blank" rel="noopener noreferrer" className="text-accent underline">TwiML Apps</a> — set its Voice URL to your <code className="text-xs bg-white/10 px-1 rounded">/functions/twilioVoiceWebhook</code> endpoint.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field('api_key_sid', 'API Key SID', 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')}
            {field('api_key_secret', 'API Key Secret', 'Your API Key Secret', 'password')}
            {field('twiml_app_sid', 'TwiML App SID', 'APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="record"
            checked={form.record_calls}
            onChange={e => setForm(f => ({ ...f, record_calls: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor="record" className="text-sm">Auto-record all calls</label>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? 'Connecting…' : 'Connect Twilio'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Find your credentials at{' '}
          <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            console.twilio.com
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

export default function TwilioHub() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['twilio-numbers'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getTwilioNumbers', {});
      return res.data;
    },
  });

  const { data: callLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['twilio-all-calls'],
    queryFn: () => base44.entities.CallLog.list('-started_at', 200),
  });

  const configured = data?.configured;
  const numbers = data?.numbers || [];
  const credential = data?.credential;

  const stats = {
    total: callLogs.length,
    completed: callLogs.filter(c => c.status === 'completed').length,
    recordings: callLogs.filter(c => c.recording_url).length,
    transcripts: callLogs.filter(c => c.transcript).length,
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto min-h-screen"
      style={{ background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)' }}
    >
      <PageHeader title="Twilio Hub" subtitle="Manage your Twilio connection, phone numbers, and call history">
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.open('https://console.twilio.com', '_blank')} className="gap-1.5">
          <ExternalLink className="w-4 h-4" /> Twilio Console
        </Button>
      </PageHeader>

      {/* Status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 border ${
        configured
          ? 'bg-emerald-500/10 border-emerald-500/25'
          : 'bg-amber-500/10 border-amber-500/25'
      }`}>
        {configured
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          : <XCircle className="w-5 h-5 text-amber-400 shrink-0" />}
        <div>
          <p className="text-sm font-semibold">
            {configured ? `Connected — ${credential?.label || 'Twilio Account'}` : 'Not Connected'}
          </p>
          <p className="text-xs text-muted-foreground">
            {configured
              ? `${numbers.length} phone number${numbers.length !== 1 ? 's' : ''} on this account`
              : 'Connect your Twilio account to enable calling from PropCRM'}
          </p>
        </div>
      </div>

      {!configured && !isLoading ? (
        <ConnectionSetup onSaved={() => { queryClient.invalidateQueries(['twilio-numbers']); refetch(); }} />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="liquid-glass p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/15">Overview</TabsTrigger>
            <TabsTrigger value="numbers" className="data-[state=active]:bg-white/15">Phone Numbers</TabsTrigger>
            <TabsTrigger value="calls" className="data-[state=active]:bg-white/15">Call History</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-white/15">Settings</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Calls', value: stats.total, icon: Phone, color: 'text-blue-400' },
                { label: 'Completed', value: stats.completed, icon: PhoneCall, color: 'text-emerald-400' },
                { label: 'Recordings', value: stats.recordings, icon: FileAudio, color: 'text-purple-400' },
                { label: 'Transcripts', value: stats.transcripts, icon: Clock, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 liquid-glass">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            <Card className="liquid-glass">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Your Numbers ({numbers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {numbers.length === 0
                  ? <p className="text-sm text-muted-foreground py-4 text-center">No numbers found on this account</p>
                  : numbers.map(n => <PhoneNumberCard key={n.phone_number} number={n} />)
                }
              </CardContent>
            </Card>

            {/* Recent calls */}
            <Card className="liquid-glass">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneIncoming className="w-4 h-4" /> Recent Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {callLogs.slice(0, 10).map(call => (
                    <div key={call.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/8">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        call.status === 'completed' ? 'bg-emerald-400' :
                        call.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{call.to_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {call.started_at ? format(new Date(call.started_at), 'MMM d, HH:mm') : '—'}
                          {call.duration_seconds ? ` · ${Math.floor(call.duration_seconds/60)}m ${call.duration_seconds%60}s` : ''}
                        </p>
                      </div>
                      <Badge className={`text-[10px] border ${
                        call.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
                        call.status === 'failed' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                        'bg-amber-500/15 text-amber-400 border-amber-500/25'
                      }`}>{call.status}</Badge>
                      {call.recording_url && <FileAudio className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    </div>
                  ))}
                  {callLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No calls yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Numbers Tab */}
          <TabsContent value="numbers">
            <Card className="liquid-glass">
              <CardHeader>
                <CardTitle>Phone Numbers</CardTitle>
                <CardDescription>All Twilio numbers on your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {numbers.length === 0
                  ? <p className="text-sm text-muted-foreground py-6 text-center">No phone numbers found</p>
                  : numbers.map(n => <PhoneNumberCard key={n.phone_number} number={n} />)
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls">
            <Card className="liquid-glass">
              <CardHeader>
                <CardTitle>All Call Logs</CardTitle>
                <CardDescription>{callLogs.length} calls recorded</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mr-2 text-muted-foreground" /> Loading…
                  </div>
                ) : (
                  <CallLogPanel leadId={null} allLogs={callLogs} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <ConnectionSetup existingCredential={credential} onSaved={() => { queryClient.invalidateQueries(['twilio-numbers']); refetch(); }} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}