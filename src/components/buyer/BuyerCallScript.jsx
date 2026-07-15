import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Sparkles, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { PB } from '@/lib/buyerPipelineTokens';

// BuyerCallScript — the Buyer Call Script Forge section (twin of landlord AICallScript).
//
// Sits inside the Lead Command Center left panel. Auto-generates a personalised call script
// the moment the buyerOrchestrator's analysis exists but no script has been forged yet, and
// re-forges when the brain re-analyses after the current script (so the script always
// reflects what the brain knows NOW). The agent can also regenerate on demand.
//
// The script is read from lead.ai_call_script (written by generateBuyerCallScript) so it
// renders instantly and survives reloads.

const GOLD = PB.GOLD;

function relativeTime(iso) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function ScriptSection({ label, accent, children }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ display: 'inline-block', width: 3, height: 11, borderRadius: 2, background: accent }} />
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: accent }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Bullet({ children, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '1px 0' }}>
      <span style={{ flex: 'none', marginTop: 6, width: 4, height: 4, borderRadius: '50%', background: color || 'rgba(255,255,255,0.35)' }} />
      <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}>{children}</span>
    </div>
  );
}

export default function BuyerCallScript({ leadId, aiCallScript, aiCallScriptAt, aiProcessedAt, onGenerated }) {
  const [collapsed, setCollapsed] = useState(false);
  const [forging, setForging] = useState(false);
  const [script, setScript] = useState(aiCallScript || null);
  const [forgedAt, setForgedAt] = useState(aiCallScriptAt || null);
  const handledAnalysis = useRef(null);

  // Sync from props when the lead record refetches after generation.
  useEffect(() => {
    if (aiCallScript) { setScript(aiCallScript); setForgedAt(aiCallScriptAt || null); }
  }, [aiCallScript, aiCallScriptAt]);

  // Auto-forge: (a) analysis exists but no script yet, or (b) the brain re-analysed AFTER the
  // current script was forged — the script re-forges from the fresh analysis.
  useEffect(() => {
    if (!leadId || !aiProcessedAt) return;
    if (handledAnalysis.current === aiProcessedAt) return;
    handledAnalysis.current = aiProcessedAt;
    if (!script) { forge(false); return; }
    const analysisNewer = forgedAt && new Date(aiProcessedAt).getTime() > new Date(forgedAt).getTime();
    if (analysisNewer) forge(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, aiProcessedAt, script, forgedAt]);

  const forge = async (force) => {
    if (!leadId || forging) return;
    setForging(true);
    try {
      const res = await base44.functions.invoke('generateBuyerCallScript', { lead_id: leadId, force: !!force });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      if (data?.skipped) { setForging(false); return; }
      if (data?.script) { setScript(data.script); setForgedAt(new Date().toISOString()); }
      if (onGenerated) await onGenerated();
    } catch (e) {
      const msg = e?.message || 'Failed to forge script';
      if (!/analysis first/i.test(msg) && !/needs_analysis/i.test(msg)) toast.error(msg);
    } finally {
      setForging(false);
    }
  };

  const hasScript = script && typeof script === 'object' && (script.opener || script.the_ask || (Array.isArray(script.discovery_questions) && script.discovery_questions.length));

  const chevronStyle = (c) => ({ transform: c ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease', color: 'rgba(255,255,255,0.4)' });

  return (
    <div style={{ marginBottom: 14, borderRadius: 12, border: '1px solid rgba(198,161,91,0.3)', background: 'linear-gradient(180deg, rgba(198,161,91,0.06), rgba(255,255,255,0.015))', overflow: 'hidden' }}>
      <div style={{ padding: '9px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setCollapsed((c) => !c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <ChevronDown size={12} style={chevronStyle(collapsed)} />
            <Sparkles size={12} style={{ color: GOLD }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>AI Call Script</span>
          </button>
          {forging && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 600, background: 'rgba(198,161,91,0.12)', border: '1px solid rgba(198,161,91,0.3)', color: GOLD }}>
              <RefreshCw size={9} className="animate-spin" /> Forging…
            </span>
          )}
          {hasScript && !forging && (
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 9, fontWeight: 600, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.28)', color: '#34d399', whiteSpace: 'nowrap' }}>Ready</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <button
              onClick={() => forge(true)}
              disabled={forging || !aiProcessedAt}
              title={aiProcessedAt ? 'Regenerate the call script from the latest AI analysis' : 'Run the AI analysis first'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 99, border: '1px solid rgba(198,161,91,0.45)', background: 'rgba(198,161,91,0.12)', color: GOLD, fontSize: 9.5, fontWeight: 600, cursor: 'pointer', opacity: (forging || !aiProcessedAt) ? 0.5 : 1 }}
            >
              <RefreshCw size={10} className={forging ? 'animate-spin' : undefined} />
              {forging ? 'Forging…' : hasScript ? 'Regenerate' : 'Generate'}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div style={{ marginTop: 8 }}>
            {!hasScript ? (
              <div style={{ padding: '14px 6px', textAlign: 'center' }}>
                {forging ? (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>The brain is forging the call script…</span>
                ) : aiProcessedAt ? (
                  <button onClick={() => forge(true)} style={{ fontSize: 11, fontWeight: 600, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Forge the call script from the AI analysis
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Run the AI analysis first — the script is forged from the brain’s report.</span>
                )}
              </div>
            ) : (
              <>
                {script.opener && (
                  <ScriptSection label="Opener · first 20 seconds" accent={GOLD}>
                    <div style={{ padding: '7px 10px', borderRadius: 9, background: 'rgba(198,161,91,0.07)', border: '1px solid rgba(198,161,91,0.2)', borderLeft: `2px solid ${GOLD}` }}>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{script.opener}</p>
                    </div>
                    {script.opener_native && (
                      <p style={{ margin: '5px 2px 0', fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>{script.opener_native}</p>
                    )}
                  </ScriptSection>
                )}

                {script.rapport && (
                  <ScriptSection label="Rapport beat" accent="#c4b5fd">
                    <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)' }}>{script.rapport}</p>
                  </ScriptSection>
                )}

                {Array.isArray(script.discovery_questions) && script.discovery_questions.length > 0 && (
                  <ScriptSection label="Discovery questions" accent="#93c5fd">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {script.discovery_questions.map((q, i) => <Bullet key={i} color="#93c5fd">{q}</Bullet>)}
                    </div>
                  </ScriptSection>
                )}

                {Array.isArray(script.value_hooks) && script.value_hooks.length > 0 && (
                  <ScriptSection label="Value hooks · real inventory" accent="#34d399">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {script.value_hooks.map((h, i) => <Bullet key={i} color="#34d399">{h}</Bullet>)}
                    </div>
                  </ScriptSection>
                )}

                {Array.isArray(script.objection_handlers) && script.objection_handlers.length > 0 && (
                  <ScriptSection label="Objection handlers" accent={PB.CLARET_TEXT}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {script.objection_handlers.map((h, i) => (
                        <div key={i} style={{ padding: '6px 9px', borderRadius: 8, background: PB.CLARET_BG, border: `1px solid ${PB.CLARET_BORDER}` }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: PB.CLARET_TEXT, marginBottom: 2 }}>⚑ “{h.objection}”</div>
                          <div style={{ fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,0.8)' }}>{h.response}</div>
                        </div>
                      ))}
                    </div>
                  </ScriptSection>
                )}

                {script.qualification_probe && (
                  <ScriptSection label="Qualification probe · the biggest gap" accent="#c4b5fd">
                    <div style={{ padding: '7px 10px', borderRadius: 9, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.22)', borderLeft: '2px solid rgba(139,92,246,0.7)' }}>
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)' }}>{script.qualification_probe}</p>
                    </div>
                  </ScriptSection>
                )}

                {script.the_ask && (
                  <ScriptSection label="The ask · one clear ask" accent={GOLD}>
                    <div style={{ padding: '7px 10px', borderRadius: 9, background: 'rgba(198,161,91,0.1)', border: '1px solid rgba(198,161,91,0.3)', borderLeft: `2px solid ${GOLD}` }}>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{script.the_ask}</p>
                    </div>
                  </ScriptSection>
                )}

                {script.close && (
                  <ScriptSection label="Close · schedule the next step" accent="#34d399">
                    <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)' }}>{script.close}</p>
                  </ScriptSection>
                )}

                {Array.isArray(script.cheat_sheet) && script.cheat_sheet.length > 0 && (
                  <ScriptSection label="Cheat sheet" accent="rgba(255,255,255,0.5)">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 9px', borderRadius: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {script.cheat_sheet.map((c, i) => <Bullet key={i}>{c}</Bullet>)}
                    </div>
                  </ScriptSection>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 7, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)' }}>{forgedAt ? `Forged ${relativeTime(forgedAt)}` : ''}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
