// AiCopilotDock — right panel of Flow. Surfaces the landlord's AI intelligence
// as tappable suggestions. Tapping a suggested message inserts it into the
// composer and records the AI-draft provenance fields.

import React from 'react';
import { Sparkles, Brain, Target, Lightbulb, ArrowRight, Clock } from 'lucide-react';

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

function Section({ icon: Icon, title, color, children }) {
  return (
    <div style={css("padding:12px 14px; border-bottom:1px solid rgba(255,255,255,0.06);")}>
      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:7px;")}>
        <Icon size={12} style={{ color, flex: 'none' }} />
        <span style={css("font-size:9.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif;")}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function AiCopilotDock({ landlord, onPickSuggestion }) {
  const suggestions = Array.isArray(landlord?.ai_suggested_messages) ? landlord.ai_suggested_messages.filter(m => m && m.text && m.text.trim()) : [];
  const nextAction = landlord?.ai_next_best_action;
  const coaching = landlord?.ai_coaching_for_agent;
  const summary = landlord?.ai_rolling_summary;

  return (
    <div style={css("display:flex; flex-direction:column; height:100%; overflow-y:auto;")}>
      <div style={css("padding:12px 14px; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:6px; flex:none;")}>
        <Sparkles size={13} style={{ color: '#c4b5fd', flex: 'none' }} />
        <span style={css("font-size:12px; font-weight:700; color:rgba(255,255,255,0.85); font-family:'Inter',sans-serif;")}>AI Co-Pilot</span>
      </div>

      {summary && (
        <Section icon={Brain} title="Rolling Summary" color="#93c5fd">
          <p style={css("font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.65); font-family:'Inter',sans-serif; margin:0;")}>{summary}</p>
        </Section>
      )}

      {nextAction && nextAction.action && (
        <Section icon={Target} title="Next Best Action" color="#fbbf24">
          <div style={css("display:flex; flex-direction:column; gap:3px;")}>
            <div style={css("display:flex; align-items:center; gap:5px;")}>
              {nextAction.priority && (
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase',
                  background: nextAction.priority === 'urgent' ? 'rgba(239,68,68,0.2)' : nextAction.priority === 'high' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)',
                  color: nextAction.priority === 'urgent' ? '#f87171' : nextAction.priority === 'high' ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                }}>{nextAction.priority}</span>
              )}
              <span style={css("font-size:11px; font-weight:600; color:rgba(255,255,255,0.8); font-family:'Inter',sans-serif;")}>{nextAction.action}</span>
            </div>
            {nextAction.reasoning && <span style={css("font-size:10px; color:rgba(255,255,255,0.4); line-height:1.4;")}>{nextAction.reasoning}</span>}
          </div>
        </Section>
      )}

      {coaching && (
        <Section icon={Lightbulb} title="Coaching" color="#a78bfa">
          <p style={css("font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.65); font-family:'Inter',sans-serif; margin:0;")}>{coaching}</p>
        </Section>
      )}

      {suggestions.length > 0 && (
        <Section icon={Sparkles} title="Suggested Messages" color="#fbbf24">
          <div style={css("display:flex; flex-direction:column; gap:6px;")}>
            {suggestions.map((m, i) => (
              <button key={i} type="button"
                onClick={() => onPickSuggestion(m.text.trim(), m)}
                style={css("display:flex; flex-direction:column; gap:4px; text-align:left; width:100%; padding:8px 10px; border-radius:9px; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2); transition:background 0.12s;")}>
                <div style={css("display:flex; align-items:center; gap:5px;")}>
                  {m.channel && <span style={css("font-size:8px; font-weight:600; padding:1px 5px; border-radius:99px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.4); text-transform:uppercase;")}>{m.channel}</span>}
                  {m.tone && <span style={css("font-size:8px; color:rgba(255,255,255,0.35);")}>{m.tone}</span>}
                  {m.language && m.language !== 'en' && <span style={css("font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; margin-left:auto;")}>{m.language}</span>}
                </div>
                <span style={css("font-size:11px; line-height:1.45; color:rgba(255,255,255,0.8);")}>{m.text.trim()}</span>
                <span style={css("display:flex; align-items:center; gap:3px; font-size:9px; font-weight:600; color:hsl(38 92% 60%); margin-top:2px;")}>
                  <ArrowRight size={9} /> Insert into composer
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {!summary && !nextAction?.action && !coaching && suggestions.length === 0 && (
        <div style={css("padding:24px 14px; text-align:center;")}>
          <Brain size={24} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 8px' }} />
          <span style={css("font-size:11px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif;")}>AI analysis hasn't been run for this landlord yet.</span>
        </div>
      )}
    </div>
  );
}