import React, { useState, useMemo, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Switch } from '@/components/ui/switch';
import { UploadCloud, FileJson, Play, Loader2, Download, AlertTriangle, CheckCircle2, Lock, RefreshCw, UserCog } from 'lucide-react';

const GOLD = '#d4af37';

function card() {
  return {
    borderRadius: 13,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.025)',
  };
}

const PHASES_DRY = ['Loading existing landlords…', 'Building dedup index…', 'Matching incoming records…', 'Computing report (no writes)…', 'Finalizing…'];
const PHASES_LIVE = ['Loading existing landlords…', 'Building dedup index…', 'Matching incoming records…', 'Creating new records…', 'Enriching existing records…', 'Finalizing…'];

export default function OwnerRegistryImport() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';

  const [fileName, setFileName] = useState('');
  const [registry, setRegistry] = useState(null);
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [assignedAgentEmail, setAssignedAgentEmail] = useState('');

  // Fetch registered users for the required "Assign to agent" selector
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await base44.entities.User.list('-created_date', 500);
        if (active) setUsers(Array.isArray(list) ? list : (list?.items || []));
      } catch (e) {
        if (active) setUsers([]);
      } finally {
        if (active) setUsersLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const incomingCount = useMemo(() => {
    if (!registry) return 0;
    return Object.values(registry).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
  }, [registry]);

  const sheetCount = useMemo(() => (registry ? Object.keys(registry).filter((k) => Array.isArray(registry[k]) && registry[k].length).length : 0), [registry]);

  // Live phase cycler while running
  useEffect(() => {
    if (!running) return;
    const phases = dryRun ? PHASES_DRY : PHASES_LIVE;
    setPhaseIdx(0);
    const t = setInterval(() => {
      setPhaseIdx((i) => Math.min(i + 1, phases.length - 1));
    }, 2600);
    return () => clearInterval(t);
  }, [running, dryRun]);

  if (!isAdmin) {
    return (
      <div className="page-root">
        <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
          <Lock style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.3)' }} />
          <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin access required.</p>
        </div>
      </div>
    );
  }

  const handleFile = async (file) => {
    setParseError(''); setResult(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('JSON must be an object keyed by sheet name.');
      }
      setRegistry(json);
    } catch (e) {
      setParseError('Invalid JSON: ' + (e.message || e));
      setRegistry(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const runImport = async () => {
    if (!registry || running) return;
    setRunning(true); setResult(null); setPhaseIdx(0);
    try {
      const res = await base44.functions.invoke('importOwnerRegistry', { registry, dry_run: dryRun, assigned_agent_email: assignedAgentEmail });
      setResult(res?.data ?? res);
    } catch (e) {
      setResult({ error: e?.response?.data?.error || e?.message || 'Import failed' });
    } finally {
      setRunning(false);
    }
  };

  const downloadErrors = () => {
    const errs = result?.errors || [];
    const blob = new Blob([JSON.stringify(errs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `owner-registry-errors-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const phases = dryRun ? PHASES_DRY : PHASES_LIVE;
  const progressPct = running ? Math.min(((phaseIdx + 1) / phases.length) * 100, 95) : (result ? 100 : 0);
  const totals = result?.totals;
  const perProject = result?.per_project || {};
  const assignedAgentLabel = assignedAgentEmail
    ? (() => { const u = users.find((x) => x.email === assignedAgentEmail); return u ? `${u.full_name || u.email} (${u.email})` : assignedAgentEmail; })()
    : '';

  return (
    <div className="page-root page-enter">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="page-title text-2xl">Owner Registry Import</h1>
          <p className="page-subtitle mt-1">Bulk-import a prepared owner-registry JSON into Landlord records. Add-only & idempotent — safe to re-run.</p>
        </div>
      </div>

      <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            ...card(),
            padding: '34px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            border: `1.5px dashed ${dragOver ? GOLD : 'rgba(255,255,255,0.16)'}`,
            background: dragOver ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.025)',
            transition: 'all 0.15s ease',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <UploadCloud size={30} style={{ color: GOLD, margin: '0 auto 10px', display: 'block' }} />
          {fileName ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <FileJson size={15} style={{ color: GOLD }} /> {fileName}
              </span>
              {registry && (
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
                  {sheetCount} sheet{sheetCount !== 1 ? 's' : ''} · {incomingCount.toLocaleString()} record{incomingCount !== 1 ? 's' : ''} ready
                </span>
              )}
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Click to replace</span>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Drop owner-registry JSON here</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>or click to browse · object keyed by sheet name</div>
            </div>
          )}
        </div>

        {parseError && (
          <div style={{ ...card(), padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 9, color: '#fca5a5', fontSize: 12.5 }}>
            <AlertTriangle size={15} /> {parseError}
          </div>
        )}

        {/* Controls */}
        <div style={{ ...card(), padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Assign to agent — required before the import can run */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <UserCog size={16} style={{ color: GOLD, flex: 'none' }} />
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Assign to agent <span style={{ color: GOLD }}>*</span></div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Every imported landlord record will be assigned to this agent.</div>
            </div>
            <select
              value={assignedAgentEmail}
              onChange={(e) => setAssignedAgentEmail(e.target.value)}
              disabled={running || usersLoading}
              style={{
                flex: 'none', minWidth: 240, maxWidth: 340, padding: '8px 11px', borderRadius: 9,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${assignedAgentEmail ? 'rgba(212,175,55,0.45)' : 'rgba(255,255,255,0.12)'}`,
                color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontFamily: "'Inter',sans-serif",
                cursor: (running || usersLoading) ? 'wait' : 'pointer',
              }}
            >
              <option value="" disabled>{usersLoading ? 'Loading agents…' : 'Select an agent…'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>{u.full_name || u.email} — {u.email}{u.role === 'admin' ? ' (admin)' : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Switch checked={dryRun} onCheckedChange={setDryRun} disabled={running} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Dry run {dryRun ? '(report only, no writes)' : 'OFF — writes enabled'}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                {dryRun ? 'Safe preview of what would happen.' : 'Will create & enrich records for real.'}
              </div>
            </div>
          </div>
          <button
            onClick={runImport}
            disabled={!registry || !assignedAgentEmail || running}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 11, fontSize: 13, fontWeight: 700,
              fontFamily: "'Inter',sans-serif", cursor: (!registry || !assignedAgentEmail || running) ? 'not-allowed' : 'pointer',
              background: (!registry || !assignedAgentEmail || running) ? 'rgba(255,255,255,0.06)' : GOLD,
              color: (!registry || !assignedAgentEmail || running) ? 'rgba(255,255,255,0.4)' : '#0a0e1a',
              border: 'none', transition: 'all 0.15s ease',
            }}
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {running ? 'Running…' : dryRun ? 'Run dry run' : 'Run import'}
          </button>
          </div>
        </div>

        {/* Progress */}
        {running && (
          <div style={{ ...card(), padding: '18px 17px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" style={{ color: GOLD }} />
                {phases[phaseIdx]}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{Math.round(progressPct)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: 99, background: 'linear-gradient(90deg, #eccd72, #d4af37)', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}

        {/* Results */}
        {result && !running && (
          <ResultsPanel result={result} perProject={perProject} totals={totals} dryRun={dryRun} assignedAgentLabel={assignedAgentLabel} onDownloadErrors={downloadErrors} onReset={() => { setResult(null); }} />
        )}
      </div>
    </div>
  );
}

function ResultsPanel({ result, perProject, totals, dryRun, assignedAgentLabel, onDownloadErrors, onReset }) {
  if (result?.error) {
    return (
      <div style={{ ...card(), padding: '15px 17px', display: 'flex', alignItems: 'center', gap: 10, color: '#fca5a5', fontSize: 13 }}>
        <AlertTriangle size={17} /> {result.error}
      </div>
    );
  }

  const projectRows = Object.entries(perProject).sort((a, b) => a[0].localeCompare(b[0]));
  const errCount = totals?.errors || 0;

  const Stat = ({ label, value, color }) => (
    <div style={{ ...card(), padding: '13px 15px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'rgba(255,255,255,0.92)', marginTop: 2 }}>{(value ?? 0).toLocaleString()}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {/* Banner */}
      <div style={{ ...card(), padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, background: dryRun ? 'rgba(96,165,250,0.07)' : 'rgba(52,211,153,0.07)', borderColor: dryRun ? 'rgba(96,165,250,0.25)' : 'rgba(52,211,153,0.25)' }}>
        <CheckCircle2 size={17} style={{ color: dryRun ? '#93c5fd' : '#34d399' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          {dryRun ? 'Dry run complete — nothing was written.' : 'Import complete.'}
        </span>
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
          {totals?.total_incoming?.toLocaleString()} record{totals?.total_incoming !== 1 ? 's' : ''} processed
        </span>
      </div>

      {/* Assigned agent confirmation */}
      {assignedAgentLabel && (
        <div style={{ ...card(), padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
          <UserCog size={14} style={{ color: GOLD, flex: 'none' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Assigned to</span>
          <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>{assignedAgentLabel}</span>
        </div>
      )}

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <Stat label="Created" value={totals?.created} color="#34d399" />
        <Stat label="Enriched" value={totals?.enriched} color="#60a5fa" />
        <Stat label="Already complete" value={totals?.already_complete} color="rgba(255,255,255,0.7)" />
        <Stat label="Errors" value={totals?.errors} color={errCount ? '#fca5a5' : 'rgba(255,255,255,0.7)'} />
      </div>

      {/* Per-project table */}
      <div style={{ ...card(), overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Per project</span>
          {errCount > 0 && (
            <button onClick={onDownloadErrors} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#fca5a5', background: 'transparent', border: '1px solid rgba(252,165,165,0.3)', padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
              <Download size={13} /> Download error log ({errCount})
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Project</th>
                <th style={{ textAlign: 'right' }}>Created</th>
                <th style={{ textAlign: 'right' }}>Enriched</th>
                <th style={{ textAlign: 'right' }}>Already complete</th>
                <th style={{ textAlign: 'right' }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {projectRows.map(([proj, c]) => (
                <tr key={proj}>
                  <td style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{proj}</td>
                  <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 600 }}>{c.created}</td>
                  <td style={{ textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>{c.enriched}</td>
                  <td style={{ textAlign: 'right', color: 'rgba(255,255,255,0.65)' }}>{c.already_complete}</td>
                  <td style={{ textAlign: 'right', color: c.errors ? '#fca5a5' : 'rgba(255,255,255,0.65)', fontWeight: c.errors ? 700 : 400 }}>{c.errors}</td>
                </tr>
              ))}
              {projectRows.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No projects</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}