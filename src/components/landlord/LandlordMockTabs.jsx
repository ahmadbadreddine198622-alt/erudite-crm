// 3-tab underline nav (Info / Activity / Pipeline) shown below the identity header.
// The Activity tab is now LIVE: it pulls this landlord's real notes, tasks, appointments,
// documents, calls and messages and renders them as one chronological feed, each row
// tagged with the agent ("by") who did it. Info/Pipeline tabs remain placeholders.
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ActivityTimeline from '@/components/landlord/ActivityTimeline';
import OutreachTab from '@/components/landlord/OutreachTab';
import NegotiationTab from '@/components/landlord/NegotiationTab';
import PipelineTab from '@/components/landlord/PipelineTab';
import LandlordInfoExtras from '@/components/landlord/LandlordInfoExtras';

// Simple two-column label/value grid — used by the Unit and Qualify tabs.
function RowsGrid({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ borderRadius: 11, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', padding: '11px 13px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{r.label}</div>
          <div style={r.valueStyle}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

const GOLD = '#C9A24B';
const TABS = ['Info', 'Activity', 'Pipeline', 'Outreach', 'Unit', 'Qualify', 'Negotiation'];

const safe = async (fn) => { try { return (await fn()) || []; } catch { return []; } };
const tsOf = (x) => { const d = new Date(x); return isNaN(d) ? 0 : d.getTime(); };
const agentLabel = (email) => (email ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null);

// Phone → the +/- match variants used for WhatsApp lookups, cleaned of spaces/dashes/parens.
function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}
function dedupeById(batches) {
  const seen = new Set(); const out = [];
  for (const row of (batches || []).flat()) {
    if (row && !seen.has(row.id)) { seen.add(row.id); out.push(row); }
  }
  return out;
}

// Entity types whose changes should refresh the Activity feed the instant they happen.
const ACTIVITY_ENTITIES = ['LandlordNote', 'LandlordTask', 'LandlordAppointment', 'LandlordDocument', 'IMessage', 'TelegramMessage', 'AircallCall', 'CallQualification', 'Email', 'CallLog', 'WhatsAppMessage'];

function useLandlordActivity(landlordId, landlord) {
  const queryClient = useQueryClient();
  const phone = landlord?.phone;

  // Realtime: subscribe to every entity type that feeds the Activity feed and invalidate
  // immediately on any create/update/delete — no polling, no stale wait.
  useEffect(() => {
    if (!landlordId) return;
    const unsubs = ACTIVITY_ENTITIES.map((name) =>
      base44.entities[name].subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['landlord_activity_feed', landlordId] });
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [landlordId, queryClient]);

  return useQuery({
    queryKey: ['landlord_activity_feed', landlordId],
    enabled: !!landlordId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const variants = phoneVariants(phone);
      const [notes, tasks, appointments, documents, imessages, telegrams, aircalls, quals, emails, callLogs, waMessages] = await Promise.all([
        safe(() => base44.entities.LandlordNote.filter({ landlord_id: landlordId }, '-created_date', 50)),
        safe(() => base44.entities.LandlordTask.filter({ landlord_id: landlordId }, '-created_date', 50)),
        safe(() => base44.entities.LandlordAppointment.filter({ landlord_id: landlordId }, '-datetime', 50)),
        safe(() => base44.entities.LandlordDocument.filter({ landlord_id: landlordId }, '-created_date', 50)),
        safe(() => base44.entities.IMessage.filter({ landlord_id: landlordId }, '-sent_at', 50)),
        safe(() => base44.entities.TelegramMessage.filter({ landlord_id: landlordId }, '-sent_at', 50)),
        safe(() => base44.entities.AircallCall.filter({ landlord_id: landlordId }, '-started_at', 50)),
        safe(() => base44.entities.CallQualification.filter({ landlord_id: landlordId }, '-call_date', 50)),
        safe(() => base44.entities.Email.filter({ landlord_id: landlordId }, '-sent_at', 50)),
        safe(() => base44.entities.CallLog.filter({ landlord_id: landlordId }, '-started_at', 50)),
        variants.length
          ? Promise.all(variants.flatMap((v) => [
              safe(() => base44.entities.WhatsAppMessage.filter({ from_number: v }, '-timestamp', 50)),
              safe(() => base44.entities.WhatsAppMessage.filter({ to_number: v }, '-timestamp', 50)),
            ])).then(dedupeById)
          : [],
      ]);

      const items = [];

      notes.forEach((n) => items.push({ type: 'note', title: 'Note added', subtitle: n.body, by: n.author_name || agentLabel(n.author_email), ts: tsOf(n.created_date) }));
      tasks.forEach((t) => items.push({ type: 'task', title: 'Task · ' + t.title, subtitle: t.due_date ? `Due ${t.due_date}` : '', by: agentLabel(t.assignee_email), ts: tsOf(t.created_date) }));
      appointments.forEach((a) => items.push({ type: a.channel === 'call' || a.type === 'call' ? 'call' : a.channel ? 'followup' : 'appointment', title: (a.channel ? 'Follow-up' : 'Appointment') + ' · ' + (a.type || ''), subtitle: a.notes || (a.datetime ? new Date(a.datetime).toLocaleString('en-GB') : ''), by: agentLabel(a.agent_email), ts: tsOf(a.datetime || a.created_date) }));
      documents.forEach((d) => items.push({ type: 'upload', title: 'Document ' + (d.status === 'missing' ? 'requested' : d.status) + ' · ' + String(d.document_type || '').replace(/_/g, ' '), subtitle: '', by: agentLabel(d.verified_by_email), ts: tsOf(d.verified_at || d.created_date) }));
      imessages.forEach((m) => items.push({ type: 'message', title: (m.direction === 'inbound' ? 'iMessage received' : 'iMessage sent'), subtitle: m.body, by: agentLabel(m.agent_email), ts: tsOf(m.sent_at || m.created_date) }));
      telegrams.forEach((m) => items.push({ type: 'message', title: (m.direction === 'inbound' ? 'Telegram received' : 'Telegram sent'), subtitle: m.body, by: agentLabel(m.agent_email), ts: tsOf(m.sent_at || m.created_date) }));
      aircalls.forEach((c) => items.push({ type: 'call', title: (c.direction === 'inbound' ? 'Inbound call' : 'Outbound call') + (c.duration ? ` · ${Math.round(c.duration / 60)}m` : ''), subtitle: c.from_number || c.to_number || '', by: c.agent_name || agentLabel(c.agent_email), ts: tsOf(c.started_at || c.created_date) }));
      quals.forEach((q) => items.push({ type: 'call', title: 'Call logged · ' + String(q.call_outcome || 'qualification').replace(/_/g, ' '), subtitle: q.agent_notes || '', by: agentLabel(q.agent_email), ts: tsOf(q.call_date || q.created_date) }));
      emails.forEach((e) => items.push({ type: 'email', title: (e.direction === 'inbound' ? 'Email received' : 'Email sent') + (e.subject ? ' · ' + e.subject : ''), subtitle: e.body || e.snippet || '', by: agentLabel(e.agent_email), ts: tsOf(e.sent_at || e.received_at || e.created_date) }));
      callLogs.forEach((c) => items.push({ type: 'call', title: (c.direction === 'inbound' ? 'Inbound call' : 'Outbound call') + ' · Twilio' + (c.duration_seconds ? ` · ${Math.round(c.duration_seconds / 60)}m` : ''), subtitle: c.from_number || c.to_number || '', by: agentLabel(c.agent_email), ts: tsOf(c.started_at || c.created_date) }));
      waMessages.forEach((m) => items.push({ type: 'message', title: (m.direction === 'inbound' ? 'WhatsApp received' : 'WhatsApp sent'), subtitle: m.body, by: agentLabel(m.assigned_agent_email), ts: tsOf(m.timestamp || m.created_date) }));

      // Synthetic "Lead created" entry showing where the lead originally came from.
      if (landlord?.created_date) {
        items.push({ type: 'followup', title: 'Lead created', subtitle: landlord.source ? `Source: ${String(landlord.source).replace(/_/g, ' ')}` : '', by: 'System', ts: tsOf(landlord.created_date) });
      }

      return items
        .filter((it) => it.ts)
        .sort((a, b) => b.ts - a.ts);
    },
  });
}

export default function LandlordMockTabs({ landlordId, landlord, outreachData, onToggleOutreachStep, outreachToggling, qualifyRows, unitRows, negotiationData, infoRows, stage, currentStageKey, pendingStage, onPendingStageChange, stageSaving, stageSaved, onSaveStage, stages, stageKeys, commissionPct, askingPriceAed, formAContractsCount, onNavigate, infoExtrasProps }) {
  const [active, setActive] = useState('Info');
  const { data: activity = [], isLoading } = useLandlordActivity(landlordId, landlord);

  return (
    <div style={{ marginTop: 14 }}>
      {/* Underline tab bar — horizontally scrollable so all tabs fit on narrow screens */}
      <div className="pipeline-scroll" style={{ display: 'flex', alignItems: 'center', gap: 22, borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {TABS.map((t) => {
          const on = active === t;
          return (
            <button
              key={t}
              onClick={() => setActive(t)}
              style={{
                flex: 'none',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 2px 12px',
                fontFamily: "'Inter',sans-serif",
                fontSize: 13.5,
                fontWeight: 700,
                color: on ? '#ffffff' : 'rgba(255,255,255,0.4)',
                borderBottom: on ? `2px solid ${GOLD}` : '2px solid transparent',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      {active === 'Info' && infoRows ? (
        <div style={{ marginTop: 14 }}>
          <RowsGrid rows={infoRows} />
          {infoExtrasProps && <LandlordInfoExtras {...infoExtrasProps} />}
        </div>
      ) : active === 'Activity' ? (
        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            border: '1px solid rgba(201,162,75,0.18)',
            background: 'rgba(255,255,255,0.03)',
            padding: '8px 14px',
            minHeight: 120,
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              <Loader2 size={14} className="animate-spin" /> Loading activity…
            </div>
          ) : activity.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
              No activity yet for this landlord.
            </div>
          ) : (
            <ActivityTimeline activity={activity} />
          )}
        </div>
      ) : active === 'Pipeline' && stage ? (
        <div style={{ marginTop: 14 }}>
          <PipelineTab
            stage={stage}
            currentStageKey={currentStageKey}
            pendingStage={pendingStage}
            onPendingStageChange={onPendingStageChange}
            stageSaving={stageSaving}
            stageSaved={stageSaved}
            onSaveStage={onSaveStage}
            stages={stages}
            stageKeys={stageKeys}
            commissionPct={commissionPct}
            askingPriceAed={askingPriceAed}
            formAContractsCount={formAContractsCount}
            onNavigate={onNavigate}
          />
        </div>
      ) : active === 'Outreach' && outreachData ? (
        <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid rgba(201,162,75,0.18)', background: 'rgba(255,255,255,0.03)', padding: '14px 14px' }}>
          <OutreachTab tab={outreachData} onToggleStep={onToggleOutreachStep} toggling={outreachToggling} />
        </div>
      ) : active === 'Unit' && unitRows ? (
        <div style={{ marginTop: 14 }}><RowsGrid rows={unitRows} /></div>
      ) : active === 'Qualify' && qualifyRows ? (
        <div style={{ marginTop: 14 }}><RowsGrid rows={qualifyRows} /></div>
      ) : active === 'Negotiation' && negotiationData ? (
        <div style={{ marginTop: 14 }}><NegotiationTab tab={negotiationData} /></div>
      ) : (
        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            border: '1px solid rgba(201,162,75,0.18)',
            background: 'rgba(255,255,255,0.03)',
            padding: '24px 18px',
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
            {active} content — coming soon
          </span>
        </div>
      )}
    </div>
  );
}