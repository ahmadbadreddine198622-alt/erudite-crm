import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Send, Loader2, Square, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const GOLD = '#c9a24b';

/**
 * WinAutoOutreachButton — launches the "Win branch" AI auto-outreach blast for the
 * Initial Contact owners of the currently filtered project. Runs the backend engine
 * in small batches, shows live progress + a per-owner log, and refreshes the board
 * when done. Supports a dry-run (drafts only, no sending).
 */
export default function WinAutoOutreachButton({ projectId, projectName, initialCount, landlordIds }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, remaining: initialCount, total: initialCount });
  const stopRef = useRef(false);
  const qc = useQueryClient();

  const disabled = !initialCount || running;

  const reset = () => {
    setLog([]);
    setProgress({ sent: 0, failed: 0, remaining: initialCount, total: initialCount });
  };

  const run = async () => {
    setRunning(true);
    stopRef.current = false;
    reset();
    let totalSent = 0;
    let totalFailed = 0;
    const BATCH = 8;
    let guard = 0;
    while (!stopRef.current && guard < 200) {
      guard++;
      let res;
      try {
        res = await base44.functions.invoke('winBranchAutoOutreach', {
          project_id: projectId || undefined,
          project_name: !projectId ? projectName : undefined,
          landlord_ids: landlordIds && landlordIds.length ? landlordIds : undefined,
          limit: BATCH,
          send: !dryRun,
          channel: 'personal',
        });
      } catch (e) {
        toast.error('Blast failed: ' + (e?.message || e));
        break;
      }
      const d = res?.data ?? res;
      if (d?.error) {
        toast.error(d.error);
        break;
      }
      const sent = d.sent || 0;
      const failed = d.failed || 0;
      totalSent += sent;
      totalFailed += failed;
      const remaining = d.remaining ?? 0;
      setProgress({ sent: totalSent, failed: totalFailed, remaining, total: d.totalQueue ?? progress.total });
      (d.details || []).forEach((det) => {
        setLog((prev) => [{ t: new Date().toLocaleTimeString('en-GB'), ...det }, ...prev].slice(0, 120));
      });
      if (!d.processed || remaining === 0) break;
    }
    setRunning(false);
    qc.invalidateQueries({ queryKey: ['landlords'] });
    toast.success(
      dryRun
        ? `Drafts generated: ${totalSent}`
        : `Blast complete — ${totalSent} sent, ${totalFailed} failed`,
    );
  };

  const pct = progress.total > 0 ? Math.round(((progress.total - progress.remaining) / progress.total) * 100) : 0;

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset(); }}
        disabled={disabled}
        className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 rounded-md shrink-0 whitespace-nowrap disabled:opacity-40"
        style={{
          height: 28,
          background: 'linear-gradient(135deg, rgba(198,161,91,0.20), rgba(198,161,91,0.08))',
          border: '1px solid rgba(198,161,91,0.45)',
          color: '#C6A15B',
          boxShadow: '0 0 16px rgba(198,161,91,0.28)',
          transition: 'box-shadow 150ms ease',
        }}
        title="AI auto-crafts + sends a personalized first WhatsApp touch to every Initial Contact owner, then moves them to Attempted to Contact."
      >
        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
        AI Auto-Outreach
        {initialCount > 0 && <span className="tabular-nums opacity-80">({initialCount})</span>}
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && !running) reset(); }}>
        <DialogContent className="max-w-lg" style={{ background: 'hsl(222 47% 9%)', border: '1px solid rgba(201,162,75,0.3)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base" style={{ color: GOLD }}>
              <Sparkles className="w-4 h-4" /> AI Auto-Outreach — Win Branch
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {dryRun
                ? 'Dry run: AI will craft a personalized first-touch WhatsApp draft for each Initial Contact owner without sending. Review them in the log below.'
                : 'AI will craft + send a personalized first-touch WhatsApp message to every Initial Contact owner for this project, then advance each to “Attempted to Contact”. Owners already contacted are skipped automatically.'}
            </DialogDescription>
          </DialogHeader>

          {/* Dry-run toggle */}
          <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            Dry run (generate drafts only — do NOT send)
          </label>

          {/* Progress */}
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between text-[11px] mb-2">
              <span className="text-white/60">
                {progress.total} owners in queue
              </span>
              <span className="flex items-center gap-3 tabular-nums">
                <span className="text-emerald-400">✓ {progress.sent} sent</span>
                <span className="text-red-400">✕ {progress.failed} failed</span>
                <span className="text-white/40">{progress.remaining} left</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}, #e3c06a)` }} />
            </div>
          </div>

          {/* Live log */}
          <div className="max-h-56 overflow-y-auto rounded-lg p-2 space-y-1.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {log.length === 0 ? (
              <p className="text-[11px] text-white/30 text-center py-4">
                {running ? 'Working…' : 'Press Start to begin the blast.'}
              </p>
            ) : log.map((d, i) => (
              <div key={i} className="text-[11px] flex items-start gap-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                <span className="text-white/30 tabular-nums shrink-0">{d.t}</span>
                <span className="font-medium shrink-0" style={{ color: d.status === 'sent' ? '#7fdcb4' : d.status === 'draft' ? '#e3c06a' : '#fda4af' }}>
                  {d.name}
                </span>
                <span className="text-white/40 shrink-0">· {d.status.replace(/_/g, ' ')}</span>
                {d.error && <span className="text-red-400/80 truncate">{d.error}</span>}
                {d.message && (
                  <span className="text-white/55 truncate" title={d.message}>{d.message}</span>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            {running ? (
              <Button variant="destructive" onClick={() => { stopRef.current = true; }} className="gap-2">
                <Square className="w-3.5 h-3.5" /> Stop
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button
                  onClick={run}
                  disabled={!initialCount}
                  className="gap-2"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #b08c2e)`, color: '#0a0e1a', border: `1px solid rgba(201,162,75,0.5)` }}
                >
                  {dryRun ? <><Eye className="w-3.5 h-3.5" /> Generate Drafts</> : <><Send className="w-3.5 h-3.5" /> Start Blast</>}
                </Button>
              </>
            )}
            {running && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}