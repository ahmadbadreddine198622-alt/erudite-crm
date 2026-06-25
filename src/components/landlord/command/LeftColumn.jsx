// Left "ACT NOW" column: Next Best Action hero → AI Coaching → Suggested Messages →
// Deal Thesis / Rolling Summary → Objections / Open Questions → Activity timeline
// (+ suggested tasks & follow-ups). Read-only consume of existing AI fields.
import { useState } from 'react';
import { Copy, Send as SendIcon } from 'lucide-react';
import { toast } from 'sonner';
import CommandCard from './CommandCard.jsx';
import { PALETTE, PRIORITY_COLOR, titleize, dirForLang, relativeTime } from './cmdHelpers.js';

function SuggestedMessage({ msg, onSend }) {
  const [sending, setSending] = useState(false);
  const lang = msg.language || '';
  const badges = [msg.channel, lang, msg.tone, msg.intent, msg.mode].filter(Boolean);
  const copy = () => {
    navigator.clipboard?.writeText(msg.text || '').then(() => toast.success('Copied')).catch(() => toast.error('Copy failed'));
  };
  const send = async () => {
    setSending(true);
    try { await onSend(msg); } finally { setSending(false); }
  };
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${PALETTE.cardBorder}` }}>
      <div className="flex flex-wrap gap-1 mb-2">
        {badges.map((b, i) => (
          <span key={i} className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,162,75,0.14)', color: PALETTE.gold }}>{b}</span>
        ))}
      </div>
      <div dir={dirForLang(lang)} className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: PALETTE.text }}>{msg.text}</div>
      {msg.rationale && <div className="text-[11px] mt-1.5" style={{ color: PALETTE.textDim }}>{msg.rationale}</div>}
      <div className="flex items-center gap-2 mt-2.5">
        <button onClick={copy} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: PALETTE.textDim, border: '1px solid rgba(255,255,255,0.1)' }}>
          <Copy className="w-3 h-3" /> Copy
        </button>
        <button onClick={send} disabled={sending} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold" style={{ background: `${PALETTE.gold}1f`, color: PALETTE.gold, border: `1px solid ${PALETTE.gold}44`, opacity: sending ? 0.6 : 1 }}>
          <SendIcon className="w-3 h-3" /> {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default function LeftColumn({ raw, vm, onDoNextBest, onSendSuggested, onCreateTask, timeline }) {
  const nba = raw.ai_next_best_action && typeof raw.ai_next_best_action === 'object' ? raw.ai_next_best_action : null;
  const messages = Array.isArray(raw.ai_suggested_messages) ? raw.ai_suggested_messages : [];
  const objections = Array.isArray(raw.ai_objections) ? raw.ai_objections : [];
  const openQs = Array.isArray(raw.ai_open_questions) ? raw.ai_open_questions.filter((q) => q && (q.question || typeof q === 'string')) : [];
  const tasks = Array.isArray(raw.ai_suggested_tasks) ? raw.ai_suggested_tasks.filter((t) => t && t.template_key) : [];
  const followups = Array.isArray(raw.ai_suggested_followups) ? raw.ai_suggested_followups.filter((f) => f && f.template_key) : [];
  const thesis = (typeof raw.ai_deal_thesis === 'string' && raw.ai_deal_thesis.trim()) ? raw.ai_deal_thesis.trim() : null;

  return (
    <div className="flex flex-col gap-3">
      {/* NEXT BEST ACTION — hero */}
      <CommandCard icon="★" title="Next Best Action" accent={PALETTE.gold}>
        {nba ? (
          <>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mb-2"
              style={{ background: `${PRIORITY_COLOR[nba.priority] || PRIORITY_COLOR.medium}22`, color: PRIORITY_COLOR[nba.priority] || PRIORITY_COLOR.medium }}>
              {nba.priority || 'medium'}
            </span>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: PALETTE.text, lineHeight: 1.25 }}>{nba.action}</div>
            {nba.reasoning && <p className="text-[13px] mt-2 leading-relaxed" style={{ color: PALETTE.textDim }}>{nba.reasoning}</p>}
            <button onClick={() => onDoNextBest(nba)} className="mt-3 h-9 px-4 rounded-lg text-[13px] font-bold" style={{ background: PALETTE.gold, color: '#0B1F3A' }}>
              Do it
            </button>
          </>
        ) : (
          <p className="text-[13px]" style={{ color: PALETTE.textDim }}>No action queued — re-run the brain.</p>
        )}
      </CommandCard>

      {/* AI COACHING */}
      {raw.ai_coaching_for_agent && (
        <CommandCard icon="🎓" title="AI Coaching" accent={PALETTE.gold}>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: PALETTE.text }}>{raw.ai_coaching_for_agent}</p>
        </CommandCard>
      )}

      {/* SUGGESTED MESSAGES */}
      {messages.length > 0 && (
        <CommandCard icon="💬" title="Suggested Messages" accent={PALETTE.gold} count={messages.length}>
          <div className="flex flex-col gap-2.5">
            {messages.map((m, i) => <SuggestedMessage key={i} msg={m} onSend={onSendSuggested} />)}
          </div>
        </CommandCard>
      )}

      {/* DEAL THESIS / ROLLING SUMMARY */}
      <CommandCard icon="📘" title="Deal Thesis & Summary" accent="#c4b5fd">
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: PALETTE.textFaint }}>Deal Thesis</div>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: thesis ? PALETTE.text : PALETTE.textDim, fontStyle: thesis ? 'normal' : 'italic' }}>
          {thesis || 'The deal thesis builds as the relationship deepens — engaged landlords get a full strategic plan here.'}
        </p>
        {raw.ai_rolling_summary && (
          <>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 mt-3" style={{ color: PALETTE.textFaint }}>Rolling Summary</div>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: PALETTE.text }}>{raw.ai_rolling_summary}</p>
          </>
        )}
      </CommandCard>

      {/* OBJECTIONS / NEEDS YOUR INPUT */}
      {(objections.length > 0 || openQs.length > 0) && (
        <CommandCard icon="⚠" title="Objections & Open Questions" accent={PALETTE.amber}>
          {objections.length > 0 && (
            <ul className="flex flex-col gap-1.5 mb-3">
              {objections.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: PALETTE.text }}>
                  <span style={{ color: PALETTE.amber }}>⚠</span> {o}
                </li>
              ))}
            </ul>
          )}
          {openQs.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: PALETTE.textFaint }}>Needs your input</div>
              <ul className="flex flex-col gap-2">
                {openQs.map((q, i) => (
                  <li key={i} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${PALETTE.cardBorder}` }}>
                    <div className="text-[13px] font-semibold" style={{ color: PALETTE.text }}>❓ {typeof q === 'string' ? q : q.question}</div>
                    {q.why && <div className="text-[11px] mt-0.5" style={{ color: PALETTE.textDim }}>{q.why}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CommandCard>
      )}

      {/* SUGGESTED TASKS & FOLLOW-UPS */}
      {(tasks.length > 0 || followups.length > 0) && (
        <CommandCard icon="✅" title="Suggested Next Tasks" accent={PALETTE.green}>
          <div className="flex flex-col gap-2">
            {tasks.map((t, i) => (
              <div key={`t-${i}`} className="flex items-start justify-between gap-2 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${PALETTE.cardBorder}` }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: PALETTE.text }}>{titleize(t.template_key)}</div>
                  {t.reason && <div className="text-[11px] mt-0.5" style={{ color: PALETTE.textDim }}>{t.reason}</div>}
                </div>
                <button onClick={() => onCreateTask(t)} className="shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-semibold" style={{ background: `${PALETTE.green}1f`, color: PALETTE.green, border: `1px solid ${PALETTE.green}40` }}>Create</button>
              </div>
            ))}
            {followups.map((f, i) => (
              <div key={`f-${i}`} className="flex items-center gap-2 rounded-lg p-2.5 text-[12px]" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${PALETTE.cardBorder}` }}>
                <span style={{ color: PALETTE.blue }}>🕓</span>
                <span style={{ color: PALETTE.text }}>{titleize(f.template_key)}</span>
                <span style={{ color: PALETTE.textDim }}>· {f.channel || 'whatsapp'} · in {f.when_offset_days ?? 1}d</span>
              </div>
            ))}
          </div>
        </CommandCard>
      )}

      {/* ACTIVITY TIMELINE */}
      <CommandCard icon="🕓" title="Activity Timeline" accent={PALETTE.blue} count={timeline.length}>
        {timeline.length === 0 ? (
          <p className="text-[13px]" style={{ color: PALETTE.textDim }}>No activity yet — calls, messages and stage changes appear here.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
            {timeline.map((ev, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${PALETTE.cardBorder}` }}>
                <span className="shrink-0 text-[14px]">{ev.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: PALETTE.text }}>{ev.title}</span>
                    <span className="text-[10px] shrink-0" style={{ color: PALETTE.textFaint }}>{relativeTime(ev.ts)}</span>
                  </div>
                  {ev.body && <div className="text-[12px] mt-0.5 truncate" style={{ color: PALETTE.textDim }}>{ev.body}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CommandCard>
    </div>
  );
}