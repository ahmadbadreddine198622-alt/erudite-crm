import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, RefreshCw, Loader2,
  CheckCircle2, XCircle, FileAudio, Clock, ExternalLink, User, Mic,
  ArrowDownLeft, ArrowUpRight, Voicemail, Settings, Radio
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';

const STATUS_CONFIG = {
  done:      { label: 'Done',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: CheckCircle2 },
  missed:    { label: 'Missed',    color: 'bg-red-500/15 text-red-400 border-red-500/25',             icon: PhoneMissed },
  voicemail: { label: 'Voicemail', color: 'bg-purple-500/15 text-purple-400 border-purple-500/25',    icon: Voicemail },
  busy:      { label: 'Busy',      color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',       icon: XCircle },
};

function formatDur(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function CallRow({ call }) {
  const cfg = STATUS_CONFIG[call.status] || STATUS_CONFIG.done;
  const Icon = cfg.icon;
  const isInbound = call.direction === 'inbound';

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:bg-white/5"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>

      {/* Direction icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isInbound ? 'bg-blue-500/15' : 'bg-amber-500/15'}`}>
        {isInbound
          ? <ArrowDownLeft className="w-4 h-4 text-blue-400" />
          : <ArrowUpRight className="w-4 h-4 text-amber-400" />}
      </div>

      {/* Contact / phone */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {call.lead_name || call.from_number || call.to_number || 'Unknown'}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {call.from_number}
          {call.aircall_line_name && <span className="ml-1.5 opacity-60">· {call.aircall_line_name}</span>}
        </p>
      </div>

      {/* Agent */}
      {call.agent_name && (
        <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground min-w-0 max-w-[120px]">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{call.agent_name}</span>
        </div>
      )}

      {/* Duration */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground w-16 justify-end shrink-0">
        <Clock className="w-3 h-3" />
        {formatDur(call.duration)}
      </div>

      {/* Time */}
      <div className="text-[11px] text-muted-foreground w-24 text-right shrink-0 hidden sm:block">
        {call.started_at ? format(new Date(call.started_at), 'dd MMM, HH:mm') : '—'}
      </div>

      {/* Status badge */}
      <Badge className={`text-[10px] border shrink-0 ${cfg.color}`}>
        <Icon className="w-2.5 h-2.5 mr-1" />{cfg.label}
      </Badge>

      {/* Recording link */}
      {call.recording_url && (
        <a href={call.recording_url} target="_blank" rel="noopener noreferrer"
          title="Listen to recording"
          className="shrink-0 text-purple-400 hover:text-purple-300 transition-colors">
          <FileAudio className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function SetupGuide() {
  return (
    <Card style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="w-5 h-5 text-amber-400" /> Connect Aircall to PropCRM
        </CardTitle>
        <CardDescription>Follow the steps below to sync your Aircall account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Step 1 */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-sm font-semibold text-indigo-300">Step 1 — Get your Aircall API credentials</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Go to your <strong className="text-white/80">Aircall Dashboard</strong> →{' '}
            <strong className="text-white/80">Integrations &amp; API</strong> → <strong className="text-white/80">API Keys</strong>.
            Copy your <strong className="text-white/80">API ID</strong> and <strong className="text-white/80">API Token</strong>.
          </p>
          <a
            href="https://dashboard.aircall.io/integrations/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-indigo-300 underline font-medium"
          >
            Open Aircall API Keys → <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Step 2 */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-sm font-semibold text-amber-300">Step 2 — Set credentials in PropCRM secrets</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            In the Base44 dashboard, go to <strong className="text-white/80">Settings → Secrets</strong> and add:
          </p>
          <div className="space-y-1">
            {[
              { key: 'AIRCALL_API_ID', desc: 'Your Aircall API ID (numeric)' },
              { key: 'AIRCALL_API_TOKEN', desc: 'Your Aircall API Token (long string)' },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-start gap-2">
                <code className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 60%)' }}>{key}</code>
                <span className="text-[11px] text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 3 */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <p className="text-sm font-semibold text-emerald-300">Step 3 — Set up Aircall Webhook (real-time sync)</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            In Aircall Dashboard → <strong className="text-white/80">Integrations → Webhooks</strong>, add a new webhook pointing to your PropCRM function endpoint below. This ensures every call is logged in real time.
          </p>
          <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <code className="text-[11px] text-emerald-300 font-mono break-all flex-1">
              {window.location.origin.replace('app.', 'functions.')}/aircallWebhook
            </code>
            <button
              onClick={() => {
                const url = `${window.location.origin.replace('app.', 'functions.')}/aircallWebhook`;
                navigator.clipboard.writeText(url);
                toast.success('Webhook URL copied!');
              }}
              className="text-[10px] px-2 py-1 rounded border border-white/20 hover:bg-white/10 transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Subscribe to events: <strong className="text-white/70">call.created</strong>, <strong className="text-white/70">call.ended</strong></p>
        </div>

        {/* Step 4 */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <p className="text-sm font-semibold text-cyan-300">Step 4 — Sync your Aircall contacts to CRM</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            PropCRM matches calls to your existing Leads and Landlords by phone number. When a match is found, the caller's name appears in both Aircall and the CRM. Click <strong className="text-white/80">"Sync Now"</strong> after setup to pull in historical calls.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AircallHub() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [tab, setTab] = useState('calls');
  const [filter, setFilter] = useState('all');

  const { data: calls = [], isLoading, refetch } = useQuery({
    queryKey: ['aircall-calls'],
    queryFn: () => base44.entities.AircallCall.list('-started_at', 300),
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAircallCalls', {});
      const d = res.data;
      if (d?.success) {
        toast.success(d.message || 'Sync complete');
        setLastSync(new Date());
        await refetch();
        queryClient.invalidateQueries({ queryKey: ['aircall-calls'] });
      } else {
        toast.error(d?.error || 'Sync failed');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = filter === 'all' ? calls : calls.filter(c => c.status === filter || c.direction === filter);

  const stats = {
    total: calls.length,
    done: calls.filter(c => c.status === 'done').length,
    missed: calls.filter(c => c.status === 'missed').length,
    recorded: calls.filter(c => c.recording_url).length,
    matched: calls.filter(c => c.lead_name).length,
  };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'inbound', label: 'Inbound' },
    { key: 'outbound', label: 'Outbound' },
    { key: 'done', label: 'Done' },
    { key: 'missed', label: 'Missed' },
    { key: 'voicemail', label: 'Voicemail' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto min-h-screen page-root">
      <PageHeader
        title="Aircall Hub"
        subtitle="Call logs, history and CRM sync from your Aircall account"
      >
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.open('https://dashboard.aircall.io', '_blank')} className="gap-1.5">
          <ExternalLink className="w-4 h-4" /> Aircall Dashboard
        </Button>
      </PageHeader>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 border"
        style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)' }}>
        <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-300">Aircall Integration Active</p>
          <p className="text-[11px] text-muted-foreground">
            {stats.total} calls synced · {stats.matched} matched to CRM contacts
            {lastSync && ` · Last sync ${formatDistanceToNow(lastSync, { addSuffix: true })}`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Calls', value: stats.total, icon: Phone, color: 'text-blue-400' },
          { label: 'Completed', value: stats.done, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Missed', value: stats.missed, icon: PhoneMissed, color: 'text-red-400' },
          { label: 'Recordings', value: stats.recorded, icon: Mic, color: 'text-purple-400' },
          { label: 'CRM Matched', value: stats.matched, icon: User, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 liquid-glass">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-[11px] text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="liquid-glass p-1">
          <TabsTrigger value="calls" className="data-[state=active]:bg-white/15">Call History</TabsTrigger>
          <TabsTrigger value="setup" className="data-[state=active]:bg-white/15">Setup & Webhooks</TabsTrigger>
        </TabsList>

        {/* Call History */}
        <TabsContent value="calls" className="space-y-4">
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filter === f.key
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Card style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PhoneIncoming className="w-4 h-4 text-blue-400" />
                {filtered.length} call{filtered.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" /> Loading calls…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Phone className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No calls found</p>
                  <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Sync from Aircall
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(call => (
                    <CallRow key={call.id} call={call} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Setup Guide */}
        <TabsContent value="setup">
          <SetupGuide />
        </TabsContent>
      </Tabs>
    </div>
  );
}