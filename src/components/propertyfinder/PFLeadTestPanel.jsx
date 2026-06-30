import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, CheckCircle2, AlertCircle, FlaskConical, XCircle } from 'lucide-react';

const STEP_LABELS = {
  authenticate:      { icon: '🔐', label: 'Authenticate' },
  fetch_users:       { icon: '👥', label: 'Fetch Users' },
  fetch_location:    { icon: '📍', label: 'Location Search' },
  create_listing:    { icon: '📝', label: 'Create Test Listing' },
  publish_listing:   { icon: '🚀', label: 'Publish Listing' },
  unpublish_listing: { icon: '📦', label: 'Unpublish Listing' },
  delete_listing:    { icon: '🗑️', label: 'Cleanup (Delete)' },
};

function StepRow({ step }) {
  const meta = STEP_LABELS[step.step] || { icon: '•', label: step.step };
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      step.ok
        ? 'bg-green-500/10 border-green-500/25'
        : 'bg-red-500/10 border-red-500/25'
    }`}>
      <span className="text-lg leading-none mt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{meta.label}</span>
          {step.ok
            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
            : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          }
          {step.listing_id && (
            <span className="text-xs font-mono text-muted-foreground ml-auto">ID: {step.listing_id}</span>
          )}
          {step.public_profile_id && (
            <span className="text-xs font-mono text-muted-foreground ml-auto">Profile: {step.public_profile_id}</span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${step.ok ? 'text-green-300/80' : 'text-red-300/80'}`}>{step.message}</p>
        {step.detail && !step.ok && (
          <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all bg-black/20 rounded p-1.5 max-h-24 overflow-y-auto">
            {JSON.stringify(step.detail, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function PFLeadTestPanel({ environment = 'sandbox' }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runTest() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('pfSandboxTest', {});
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Test failed');
    } finally {
      setRunning(false);
    }
  }

  const allPassed = result?.ok === true;
  const failedAt = result?.steps?.find(s => !s.ok);

  return (
    <Card className="border-amber-500/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          Sandbox End-to-End Test
          <span className="ml-auto text-xs font-normal text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Sandbox only
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Creates a test listing → publishes it → unpublishes it → deletes it. All in sandbox. No production data touched.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flow steps preview */}
        <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
          {Object.values(STEP_LABELS).map((s, i, arr) => (
            <span key={s.label} className="flex items-center gap-1">
              <span>{s.icon}</span>
              <span>{s.label}</span>
              {i < arr.length - 1 && <span className="text-muted-foreground/40 mx-0.5">→</span>}
            </span>
          ))}
        </div>

        <Button
          onClick={runTest}
          disabled={running}
          className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40"
        >
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running sandbox test…</>
            : <><Play className="w-4 h-4" /> Run Full Sandbox Test</>
          }
        </Button>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            {/* Summary banner */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border font-semibold text-sm ${
              allPassed
                ? 'bg-green-500/15 border-green-500/35 text-green-400'
                : 'bg-red-500/15 border-red-500/35 text-red-400'
            }`}>
              {allPassed
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <XCircle className="w-4 h-4 shrink-0" />
              }
              {result.summary}
            </div>

            {/* Step-by-step results */}
            <div className="space-y-2">
              {result.steps?.map((step, i) => (
                <StepRow key={i} step={step} />
              ))}
            </div>

            {allPassed && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                🎉 Sandbox is fully working. You're ready to go live — switch to Production in Settings.
              </p>
            )}
            {!allPassed && failedAt && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                Fix the issue at <strong>{STEP_LABELS[failedAt.step]?.label || failedAt.step}</strong> then re-run.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}