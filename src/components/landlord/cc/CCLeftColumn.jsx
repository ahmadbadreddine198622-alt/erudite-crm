// Left "act now" column: Next Best Action hero → Coaching → Suggested Messages →
// Thesis/Summary → Objections / Open Questions → Activity timeline (+ tasks & follow-ups).
import React from 'react';
import { Card, EmptyLine, Chip, GOLD, relativeTime, titleize } from './ccPrimitives';
import CCSuggestedMessages from './CCSuggestedMessages';

const PRIORITY_META = {
  urgent: { color: '#f87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.4)' },
  high: { color: '#fb923c', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.4)' },
  medium: { color: '#93c5fd', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.4)' },
  low: { color: 'rgba(255,255,255,0.6)', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
};

function NextBestAction({ nba, onDoIt }) {
  if (!nba || !nba.action) {
    return (
      <Card icon="★" title="Next Best Action" accent={GOLD}>
        <EmptyLine>No action queued — re-run the brain.</EmptyLine>
      </Card>
    );
  }
  const pm = PRIORITY_META[String(nba.priority || 'medium').toLowerCase()] || PRIORITY_META.medium;
  return (
    <div className="cc-card cc-hoverable" style={{ background: 'linear-gradient(180deg, rgba(201,162,75,0.1), rgba(11,31,58,1))', border: '1px solid rgba(201,162,75,0.45)', borderRadius: 16, padding: '16px 18px', animation: 'cc-rise 0.4s cubic-bezier(0.22,1,0.36,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 15 }}>★</span>
        <span className="cc-title" style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.97)' }}>Next Best Action</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 9px', borderRadius: 99, color: pm.color, background: pm.bg, border: `1px solid ${pm.border}` }}>{titleize(nba.priority || 'medium')}</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, color: 'rgba(255,255,255,0.96)' }}>{nba.action}</div>
      {nba.reasoning && <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>{nba.reasoning}</div>}
      <button onClick={onDoIt} style={{ marginTop: 12, padding: '9px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: `linear-gradient(180deg, ${GOLD}, #b08d3e)`, color: '#1a1205', border: 'none', fontFamily: 'Montserrat,sans-serif' }}>Do it →</button>
    </div>
  );
}

function ActivityTimeline({ events, tasks, followups, onCreateTask }) {
  return (
    <Card icon="🕓" title="Activity Timeline" accent={GOLD}>
      {(!events || events.length === 0) ? (
        <EmptyLine>No activity yet — calls, messages and stage changes appear here.</EmptyLine>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 2px' }}>
              <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: 'rgba(255,255,255,0.05)' }}>{e.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{e.title}</span>
                  <span style={{ flex: 'none', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{e.time}</span>
                </div>
                {e.body && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.4 }}>{e.body}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(followups) && followups.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 7 }}>Upcoming follow-ups</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {followups.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                <Chip label={f.channel || 'whatsapp'} style={{ fontSize: 9 }} />
                <span style={{ fontWeight: 600 }}>{titleize(f.template_key)}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>in {f.when_offset_days ?? 1}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(tasks) && tasks.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 7 }}>Suggested next tasks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{t.label || titleize(t.template_key)}</div>
                  {t.reason && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', marginTop: 1, lineHeight: 1.35 }}>{t.reason}</div>}
                </div>
                <button onClick={() => onCreateTask(t)} style={{ flex: 'none', padding: '5px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', background: `${GOLD}1f`, border: `1px solid ${GOLD}55`, color: GOLD, fontFamily: 'Montserrat,sans-serif' }}>Create</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function CCLeftColumn({ vm, actions }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <NextBestAction nba={vm.aiNextBestAction} onDoIt={actions.onDoNextAction} />

      {vm.aiCoaching && (
        <Card icon="🎓" title="AI Coaching" accent={GOLD} style={{ borderLeftColor: GOLD, background: 'rgba(201,162,75,0.05)' }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>{vm.aiCoaching}</div>
        </Card>
      )}

      <CCSuggestedMessages messages={vm.aiSuggestedMessages} onSend={actions.onSendSuggested} />

      <Card icon="📘" title="Deal Thesis" accent="#3B5C8A">
        {vm.aiDealThesis
          ? <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>{vm.aiDealThesis}</div>
          : <EmptyLine>The deal thesis builds as the relationship deepens — engaged landlords get a full strategic plan here.</EmptyLine>}
        {vm.aiRollingSummary && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>Rolling summary</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap' }}>{vm.aiRollingSummary}</div>
          </div>
        )}
      </Card>

      {Array.isArray(vm.aiObjections) && vm.aiObjections.length > 0 && (
        <Card icon="⚠" title="Objections" accent="#f87171" count={vm.aiObjections.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {vm.aiObjections.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.45 }}>
                <span style={{ color: '#f87171', flex: 'none' }}>⚠</span>{o}
              </div>
            ))}
          </div>
        </Card>
      )}

      {Array.isArray(vm.aiOpenQuestions) && vm.aiOpenQuestions.length > 0 && (
        <Card icon="❓" title="Needs Your Input" accent="#fbbf24" count={vm.aiOpenQuestions.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {vm.aiOpenQuestions.map((q, i) => (
              <div key={i} style={{ padding: '9px 11px', borderRadius: 9, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{q.question}</div>
                {q.why && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3, lineHeight: 1.4 }}>{q.why}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <ActivityTimeline events={vm.timeline} tasks={vm.suggestedTasks} followups={vm.suggestedFollowups} onCreateTask={actions.onCreateTask} />
    </div>
  );
}