// 3-tab underline nav (Info / Activity / Pipeline) shown below the identity header.
// The Activity tab is now LIVE: it pulls this landlord's real notes, tasks, appointments,
// documents, calls and messages and renders them as one chronological feed, each row
// tagged with the agent ("by") who did it. Info/Pipeline tabs remain placeholders.
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Phone, Mail, MessageCircle, Upload, CheckSquare, Calendar, FileText, RefreshCw, Loader2 } from 'lucide-react';

const GOLD = '#C9A24B';
const TABS = ['Info', 'Activity', 'Pipeline', 'Outreach', 'Unit', 'Qualify', 'Negotiation'];

const ACTIVITY_META = {
  call: { icon: Phone, color: '#93c5fd', bg: 'rgba(59,130,246,0.14)' },
  email: { icon: Mail, color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)' },
  message: { icon: MessageCircle, color: '#4ade80', bg: 'rgba(37,211,102,0.14)' },
  upload: { icon: Upload, color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)' },
  task: { icon: CheckSquare, color: '#34d399', bg: 'rgba(16,185,129,0.14)' },
  appointment: { icon: Calendar, color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)' },
  note: { icon: FileText, color: 'rgba(255,255,255,0.7)', bg: 'rgba(255,255,255,0.06)' },
  followup: { icon: RefreshCw, color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)' },
};

const safe = async (fn) => { try { return (await fn()) || []; } catch { return []; } };
const tsOf = (x) => { const d = new Date(x); return isNaN(d) ? 0 : d.getTime(); };
const agentLabel = (email) => (email ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null);
const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function ActivityRow({ item }) {
  const meta = ACTIVITY_META[item.type] || ACTIVITY_META.note;
  const Icon = meta.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 2px' }}>
      <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.bg, color: meta.color }}>
        <Icon size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Inter',sans-serif" }}>{item.title}</div>
        {item.subtitle && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{item.subtitle}</div>}
        {item.by && (
          <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: GOLD, background: 'rgba(201,162,75,0.12)', border: '1px solid rgba(201,162,75,0.25)' }}>
            by {item.by}
          </span>
        )}
      </div>
      <span style={{ flex: 'none', fontSize: 10.5, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{item.time}</span>
    </div>
  );
}

function useLandlordActivity(landlordId, landlord) {
  return useQuery({
    queryKey: ['landlord_activity_feed', landlordId],
    enabled: !!landlordId,
    staleTime: 15000,
    queryFn: async () => {
      const [notes, tasks, appointments, documents, imessages, telegrams, aircalls, quals, emails] = await Promise.all([
        safe(() => base44.entities.LandlordNote.filter({ landlord_id: landlordId }, '-created_date', 50)),
        safe(() => base44.entities.LandlordTask.filter({ landlord_id: landlordId }, '-created_date', 50)),
        safe(() => base44.entities.LandlordAppointment.filter({ landlord_id: landlordId }, '-datetime', 50)),
        safe(() => base44.entities.LandlordDocument.filter({ landlord_id: landlordId }, '-created_date', 50)),
        safe(() => base44.entities.IMessage.filter({ landlord_id: landlordId }, '-sent_at', 50)),
        safe(() => base44.entities.TelegramMessage.filter({ landlord_id: landlordId }, '-sent_at', 50)),
        safe(() => base44.entities.AircallCall.filter({ landlord_id: landlordId }, '-started_at', 50)),
        safe(() => base44.entities.CallQualification.filter({ landlord_id: landlordId }, '-call_date', 50)),
        safe(() => base44.entities.Email.filter({ landlord_id: landlordId }, '-sent_at', 50)),
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

      // Synthetic "Lead created" entry showing where the lead originally came from.
      if (landlord?.created_date) {
        items.push({ type: 'followup', title: 'Lead created', subtitle: landlord.source ? `Source: ${String(landlord.source).replace(/_/g, ' ')}` : '', by: 'System', ts: tsOf(landlord.created_date) });
      }

      return items
        .filter((it) => it.ts)
        .sort((a, b) => b.ts - a.ts)
        .map((it) => ({ ...it, time: fmtTime(it.ts) }));
    },
  });
}

export default function LandlordMockTabs({ landlordId, landlord }) {
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
      {active === 'Activity' ? (
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
            activity.map((item, i) => (
              <React.Fragment key={i}>
                <ActivityRow item={item} />
                {i < activity.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />}
              </React.Fragment>
            ))
          )}
        </div>
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