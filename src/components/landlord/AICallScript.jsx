import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Sparkles, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SpeechifyPlayer from '@/components/academy/SpeechifyPlayer';
import { toast } from 'sonner';

// AICallScript — the Call Script Forge section.
//
// Sits right after the AI Intelligence card on the landlord detail page. Auto-generates a
// powerful, personalised call script the moment the orchestrator's analysis exists but no
// script has been forged yet ("as soon as we do the analysis, the system automatically
// generates a script"). The agent can also regenerate on demand.
//
// The script is read from landlord.ai_call_script (written by generateLandlordCallScript)
// so it renders instantly and survives reloads. The "Regenerate" button forces a fresh forge.

const GOLD = '#d4af37';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

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

function Section({ label, accent, children }) {
  return (
    <div style={css('margin-bottom:9px;')}>
      <div style={css('display:flex; align-items:center; gap:5px; margin-bottom:4px;')}>
        <span style={css('display:inline-block; width:3px; height:11px; border-radius:2px; background:' + accent + ';')} />
        <span style={css('font-size:8.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:' + accent + ';')}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Bullet({ children, color }) {
  return (
    <div style={css('display:flex; align-items:flex-start; gap:6px; padding:1px 0;')}>
      <span style={css('flex:none; margin-top:6px; width:4px; height:4px; border-radius:50%; background:' + (color || 'rgba(255,255,255,0.35)') + ';')} />
      <span style={css('flex:1; font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.8);')}>{children}</span>
    </div>
  );
}

export default function AICallScript({ landlordId, aiCallScript, aiCallScriptAt, aiProcessedAt, onGenerated }) {
  const [collapsed, setCollapsed] = useState(false);
  const [forging, setForging] = useState(false);
  const [script, setScript] = useState(aiCallScript || null);
  const [forgedAt, setForgedAt] = useState(aiCallScriptAt || null);
  const handledAnalysis = useRef(null);

  // Sync from props when the landlord record refetches after generation.
  useEffect(() => {
    if (aiCallScript) { setScript(aiCallScript); setForgedAt(aiCallScriptAt || null); }
  }, [aiCallScript, aiCallScriptAt]);

  // Auto-forge: (a) analysis exists but no script yet, or (b) the V3 brain re-analyzed AFTER the
  // current script was forged — new tasks/notes/activity flowed into the brain, so the script
  // re-forges from the fresh analysis and always reflects the information the brain has NOW.
  useEffect(() => {
    if (!landlordId || !aiProcessedAt) return;
    if (handledAnalysis.current === aiProcessedAt) return;
    handledAnalysis.current = aiProcessedAt;
    if (!script) { forge(false); return; }
    const analysisNewer = forgedAt && new Date(aiProcessedAt).getTime() > new Date(forgedAt).getTime();
    if (analysisNewer) forge(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId, aiProcessedAt, script, forgedAt]);

  const forge = async (force) => {
    if (!landlordId || forging) return;
    setForging(true);
    try {
      const res = await base44.functions.invoke('generateLandlordCallScript', { landlord_id: landlordId, force: !!force });
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

  // Build a single text blob for TTS of the whole script.
  const fullText = hasScript ? [
    script.opener && `Opener: ${script.opener}`,
    script.opener_native && `Native opener: ${script.opener_native}`,
    script.rapport && `Rapport: ${script.rapport}`,
    Array.isArray(script.discovery_questions) && script.discovery_questions.length ? `Discovery: ${script.discovery_questions.join(' | ')}` : '',
    Array.isArray(script.value_hooks) && script.value_hooks.length ? `Value hooks: ${script.value_hooks.join(' | ')}` : '',
    Array.isArray(script.objection_handlers) && script.objection_handlers.length ? script.objection_handlers.map((h) => `If they say "${h.objection}", respond: ${h.response}`).join(' | ') : '',
    script.portfolio_probe && `Portfolio probe: ${script.portfolio_probe}`,
    script.the_ask && `The ask: ${script.the_ask}`,
    script.close && `Close: ${script.close}`,
  ].filter(Boolean).join('. ') : '';

  const chevronStyle = (c) => ({ transform: c ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease', color: 'rgba(255,255,255,0.4)' });

  return (
    <div style={css('flex:none; margin:0 16px 6px; border-radius:12px; border:1px solid rgba(212,175,55,0.3); background:linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.015)); overflow:hidden; animation: ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both;')}>
      {/* Header */}
      <div style={css('padding:9px 12px;')}>
        <div style={css('display:flex; align-items:center; justify-content:flex-start; gap:8px; flex-wrap:wrap;')}>
          <button onClick={() => setCollapsed((c) => !c)} style={css('display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; font-family:"Inter",sans-serif; padding:0;')}>
            <ChevronDown size={12} style={chevronStyle(collapsed)} />
            <Sparkles size={12} style={{ color: GOLD }} />
            <span style={css('font-size:9px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.5);')}>AI Call Script</span>
          </button>
          {forging && (
            <span style={css('display:inline-flex; align-items:center; gap:4px; padding:2px 8px; borderRadius:99px; fontSize:9px; font-weight:600; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); color:hsl(38 92% 62%);')}>
              <RefreshCw size={9} className="animate-spin" /> Forging…
            </span>
          )}
          {hasScript && !forging && (
            <span style={css('display:inline-flex; align-items:center; padding:2px 7px; borderRadius:99px; fontSize:9px; font-weight:600; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.28); color:#34d399; white-space:nowrap;')}>Ready</span>
          )}
          <div style={css('display:flex; align-items:center; gap:6px; margin-left:auto;')}>
            {hasScript && fullText && <SpeechifyPlayer text={fullText} size={11} color={GOLD} />}
            <button
              onClick={() => forge(true)}
              disabled={forging || !aiProcessedAt}
              title={aiProcessedAt ? 'Regenerate the call script from the latest AI analysis' : 'Run the AI analysis first'}
              style={css('display:inline-flex; align-items:center; gap:4px; padding:4px 9px; borderRadius:99px; border:1px solid hsl(38 92% 50% / 0.45); background:hsl(38 92% 50% / 0.12); color:hsl(38 92% 62%); font-size:9.5px; font-weight:600; cursor:pointer; font-family:"Inter",sans-serif; opacity:' + (forging || !aiProcessedAt ? 0.5 : 1) + ';')}
            >
              <span style={css('display:inline-block; ' + (forging ? 'animation: ld-spin 0.8s linear infinite;' : ''))}>↻</span>
              {forging ? 'Forging…' : hasScript ? 'Regenerate' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Body */}
        {!collapsed && (
          <div style={css('margin-top:8px;')}>
            {!hasScript ? (
              <div style={css('padding:14px 6px; text-align:center;')}>
                {forging ? (
                  <div style={css('display:flex; align-items:center; justify-content:center; gap:7px; font-size:11px; color:rgba(255,255,255,0.55);')}>
                    <div style={css('display:inline-block; width:11px; height:11px; border:2px solid hsl(38 92% 50% / 0.25); border-top-color:hsl(38 92% 55%); border-radius:50%; animation: ld-spin 0.8s linear infinite;')} />
                    The brain is forging your call script…
                  </div>
                ) : aiProcessedAt ? (
                  <button onClick={() => forge(true)} style={css('font-size:11px; font-weight:600; color:hsl(38 92% 62%); background:none; border:none; cursor:pointer; font-family:"Inter",sans-serif; text-decoration:underline;')}>
                    Forge the call script from the AI analysis
                  </button>
                ) : (
                  <span style={css('font-size:11px; color:rgba(255,255,255,0.4);')}>Run “Analyse” first — the script is forged from the brain’s analysis.</span>
                )}
              </div>
            ) : (
              <>
                {script.opener && (
                  <Section label="Opener · first 20 seconds" accent={GOLD}>
                    <div style={css('display:flex; align-items:flex-start; gap:5px; padding:7px 10px; border-radius:9px; background:rgba(212,175,55,0.07); border:1px solid rgba(212,175,55,0.2); border-left:2px solid ' + GOLD + ';')}>
                      <p style={css('flex:1; margin:0; font-size:12px; line-height:1.5; color:rgba(255,255,255,0.88); font-weight:500;')}>{script.opener}</p>
                      <SpeechifyPlayer text={script.opener} size={10} color={GOLD} style={{ flex: 'none', marginTop: 1 }} />
                    </div>
                    {script.opener_native && (
                      <p style={css('margin:5px 2px 0; font-size:11px; line-height:1.45; color:rgba(255,255,255,0.55); font-style:italic;')}>{script.opener_native}</p>
                    )}
                  </Section>
                )}

                {script.rapport && (
                  <Section label="Rapport beat" accent="#c4b5fd">
                    <p style={css('margin:0; font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.78);')}>{script.rapport}</p>
                  </Section>
                )}

                {Array.isArray(script.discovery_questions) && script.discovery_questions.length > 0 && (
                  <Section label="Discovery questions" accent="#93c5fd">
                    <div style={css('display:flex; flex-direction:column; gap:2px;')}>
                      {script.discovery_questions.map((q, i) => <Bullet key={i} color="#93c5fd">{q}</Bullet>)}
                    </div>
                  </Section>
                )}

                {Array.isArray(script.value_hooks) && script.value_hooks.length > 0 && (
                  <Section label="Value hooks · value before price" accent="#34d399">
                    <div style={css('display:flex; flex-direction:column; gap:2px;')}>
                      {script.value_hooks.map((h, i) => <Bullet key={i} color="#34d399">{h}</Bullet>)}
                    </div>
                  </Section>
                )}

                {Array.isArray(script.objection_handlers) && script.objection_handlers.length > 0 && (
                  <Section label="Objection handlers" accent="#f87171">
                    <div style={css('display:flex; flex-direction:column; gap:5px;')}>
                      {script.objection_handlers.map((h, i) => (
                        <div key={i} style={css('padding:6px 9px; border-radius:8px; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.18);')}>
                          <div style={css('font-size:10.5px; font-weight:700; color:#fca5a5; margin-bottom:2px;')}>⚑ “{h.objection}”</div>
                          <div style={css('font-size:11px; line-height:1.45; color:rgba(255,255,255,0.8);')}>{h.response}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {script.portfolio_probe && (
                  <Section label="Portfolio probe · their other units" accent="#c4b5fd">
                    <div style={css('display:flex; align-items:flex-start; gap:5px; padding:7px 10px; border-radius:9px; background:rgba(139,92,246,0.07); border:1px solid rgba(139,92,246,0.22); border-left:2px solid rgba(139,92,246,0.7);')}>
                      <p style={css('flex:1; margin:0; font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.82);')}>{script.portfolio_probe}</p>
                      <SpeechifyPlayer text={script.portfolio_probe} size={10} color="#c4b5fd" style={{ flex: 'none', marginTop: 1 }} />
                    </div>
                  </Section>
                )}

                {script.the_ask && (
                  <Section label="The ask · one clear ask" accent={GOLD}>
                    <div style={css('padding:7px 10px; border-radius:9px; background:rgba(212,175,55,0.1); border:1px solid rgba(212,175,55,0.3); border-left:2px solid ' + GOLD + ';')}>
                      <p style={css('margin:0; font-size:12px; line-height:1.5; color:rgba(255,255,255,0.9); font-weight:600;')}>{script.the_ask}</p>
                    </div>
                  </Section>
                )}

                {script.close && (
                  <Section label="Close · schedule the next step" accent="#34d399">
                    <p style={css('margin:0; font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.78);')}>{script.close}</p>
                  </Section>
                )}

                {Array.isArray(script.cheat_sheet) && script.cheat_sheet.length > 0 && (
                  <Section label="Cheat sheet" accent="rgba(255,255,255,0.5)">
                    <div style={css('display:flex; flex-direction:column; gap:2px; padding:6px 9px; border-radius:8px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06);')}>
                      {script.cheat_sheet.map((c, i) => <Bullet key={i}>{c}</Bullet>)}
                    </div>
                  </Section>
                )}

                <div style={css('display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:7px; margin-top:4px; border-top:1px solid rgba(255,255,255,0.05);')}>
                  <span style={css('font-size:9px; color:rgba(255,255,255,0.38);')}>{forgedAt ? `Forged ${relativeTime(forgedAt)}` : ''}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}