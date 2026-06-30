import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, CheckCircle2, AlertCircle, FlaskConical, Users, Zap, RefreshCw } from 'lucide-react';

function ResultBadge({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
      ok ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
    }`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

export default function PFLeadTestPanel({ environment = 'sandbox' }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runSync() {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('syncPropertyFinderLeads', {});
      const d = res.data;
      if (d.ok === false && d.error) throw new Error(d.error);
      setResult(d);
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const isSandbox = environment === 'sandbox';

  return (
    <Card className={isSandbox ? 'border-amber-500/25' : 'border-emerald-500/25'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isSandbox
            ? <FlaskConical className="w-4 h-4 text-amber-400" />
            : <Zap className="w-4 h-4 text-emerald-400" />}
          Lead Capture Test — {isSandbox ? 'Sandbox' : 'Production'}
          {isSandbox && (
            <span className="ml-auto text-xs font-normal text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              10,000 credits · expires Aug 2026
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pulls leads from <code className="text-xs">{isSandbox ? 'sandbox.' : ''}atlas.propertyfinder.com/v1/leads</code>, deduplicates by PF lead ID, and creates / updates records in the CRM.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* What this does */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: '🔐', label: 'Authenticate', desc: 'Get JWT from PF' },
            { icon: '📥', label: 'Fetch Leads', desc: 'Up to 300/run' },
            { icon: '🔗', label: 'Sync to CRM', desc: 'Dedup + notify' },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-muted/20 border border-border p-3">
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-xs font-semibold text-foreground">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
          ))}
        </div>

        <Button
          onClick={runSync}
          disabled={syncing}
          className={`w-full gap-2 ${isSandbox ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40' : ''}`}
        >
          {syncing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running sync…</>
            : <><Play className="w-4 h-4" /> Run Lead Sync Now</>
          }
        </Button>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ResultBadge ok={result.ok} label={result.ok ? 'Sync complete' : 'Sync failed'} />
              {result.environment && (
                <span className="text-xs text-muted-foreground">via {result.environment}</span>
              )}
              {result.fetch_error && (
                <span className="text-xs text-red-400 truncate">{result.fetch_error}</span>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'PF Leads Found', value: result.total_leads_from_pf ?? 0, color: 'text-foreground' },
                { label: 'Created', value: result.created_count ?? 0, color: 'text-green-400' },
                { label: 'Updated', value: result.updated_count ?? 0, color: 'text-blue-400' },
                { label: 'Failed', value: result.failed_count ?? 0, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-muted/20 border border-border p-3 text-center">
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Per-agent breakdown */}
            {result.per_agent_counts && Object.keys(result.per_agent_counts).length > 0 && (
              <div className="rounded-lg bg-muted/10 border border-border p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
                  <Users className="w-3 h-3" /> Agent Assignment
                </div>
                <div className="space-y-1">
                  {Object.entries(result.per_agent_counts).map(([email, count]) => (
                    <div key={email} className="flex items-center justify-between text-xs">
                      <span className="text-foreground/80">{email}</span>
                      <span className="font-semibold text-foreground">{count} lead{count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample leads */}
            {result.samples && result.samples.length > 0 && (
              <div className="rounded-lg bg-muted/10 border border-border p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Sample New Leads</div>
                <div className="space-y-1.5">
                  {result.samples.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-green-400 font-mono">+</span>
                      <span className="font-medium text-foreground">{s.full_name}</span>
                      {s.phone && <span className="text-muted-foreground">{s.phone}</span>}
                      <span className="ml-auto text-muted-foreground/60 text-xs">{s.pf_lead_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.total_leads_from_pf === 0 && result.ok && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No leads found in PF {result.environment || environment} — this is expected in sandbox until test data is submitted via PF's sandbox lead form.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}