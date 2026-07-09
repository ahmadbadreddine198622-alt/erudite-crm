// CallsTabWithCopilot — self-contained Calls tab for the landlord V-card.
// Encapsulates the dial bar, Copilot toggle, LiveCopilotPanel, PostCallDebrief,
// CallQualificationTab, and CallsTabList in one focused component.
//
// Props:
//   landlordId       (string)
//   landlordName     (string)
//   phone            (string)
//   rawLandlord      (object) — full Landlord record for CallQualificationTab
//   currentUser      (object) — for agent email
//   calls            (array)  — mapped call objects for CallsTabList
//   onCallReportSaved (fn)

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import CallsTabList from './CallsTabList';
import CallQualificationTab from './CallQualificationTab';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import LiveCopilotPanel from './LiveCopilotPanel';
import PostCallDebrief from './PostCallDebrief';

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

export default function CallsTabWithCopilot({ landlordId, landlordName, phone, rawLandlord, currentUser, calls, onCallReportSaved }) {
  const [showCallQualForm, setShowCallQualForm] = useState(false);
  const [copilotEnabled, setCopilotEnabled] = useState(true);
  const [copilotCallLogId, setCopilotCallLogId] = useState(null);
  const [copilotDebriefData, setCopilotDebriefData] = useState(null);

  const handleCopilotComplete = async (data) => {
    try {
      await base44.functions.invoke('copilotCallComplete', {
        call_log_id: data.call_log_id || copilotCallLogId,
        landlord_id: landlordId,
        transcript: data.transcript,
        qualify_updates: data.qualify_updates,
        signals: data.signals,
        summary: data.summary,
      });
      setCopilotDebriefData(data);
      setCopilotCallLogId(null);
      if (onCallReportSaved) onCallReportSaved();
    } catch (e) {
      console.error('Copilot call complete failed:', e);
    }
  };

  return (
    <div className="ld-scroll" style={css("flex:1; min-height:0; overflow-y:auto; padding:8px 16px;")}>
      {/* Dial bar */}
      <div style={css("display:flex; align-items:center; gap:10px; margin-bottom:12px; padding:9px 12px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
        <button type="button"
          onClick={() => setShowCallQualForm(s => !s)}
          style={css("display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:9px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:linear-gradient(180deg, #16a34a, #15803d); color:#ffffff; border:1px solid rgba(34,197,94,0.55); touch-action:manipulation; box-shadow:0 2px 8px rgba(22,163,74,0.25);")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          {showCallQualForm ? 'Close' : 'Dial · Log Call'}
        </button>
        <span style={css("font-size:10px; color:rgba(255,255,255,0.4);")}>{showCallQualForm ? 'AI qualification form open below' : 'Log a call with full AI qualification'}</span>

        {/* Copilot toggle + Dial trigger */}
        <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
          <button type="button" onClick={() => setCopilotEnabled(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              background: copilotEnabled ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
              border: '1px solid ' + (copilotEnabled ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.1)'),
              color: copilotEnabled ? GOLD : 'rgba(255,255,255,0.4)' }}>
            🎙 Copilot {copilotEnabled ? 'ON' : 'OFF'}
          </button>
          <TwilioCallDialog
            landlord={{ id: landlordId, full_name_en: landlordName, phone }}
            phoneOverride={phone}
            copilot={copilotEnabled}
            onCallConnected={(callLogId) => { setCopilotCallLogId(callLogId); setCopilotDebriefData(null); }}
            onCallEnded={() => setCopilotCallLogId(null)}
          >
            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: '1px solid rgba(34,197,94,0.5)' }}>
              📞 Dial
            </button>
          </TwilioCallDialog>
        </div>
      </div>

      {/* Live Copilot cockpit — shown during an active copilot call */}
      {copilotCallLogId && (
        <div style={{ marginBottom: 12 }}>
          <LiveCopilotPanel
            callLogId={copilotCallLogId}
            landlordId={landlordId}
            agentEmail={currentUser?.email}
            onComplete={handleCopilotComplete}
            onClose={() => setCopilotCallLogId(null)}
          />
        </div>
      )}

      {/* Post-call debrief — shown after copilotCallComplete runs */}
      {copilotDebriefData && (
        <div style={{ marginBottom: 12 }}>
          <PostCallDebrief
            landlordId={landlordId}
            debriefData={copilotDebriefData}
            onConfirmAll={() => { if (onCallReportSaved) onCallReportSaved(); }}
            onClose={() => setCopilotDebriefData(null)}
          />
        </div>
      )}

      {/* AI call qualification form */}
      {showCallQualForm && (
        <div style={css("margin-bottom:14px; border-radius:11px; overflow:hidden; border:1px solid rgba(250,180,40,0.18);")}>
          <CallQualificationTab landlord={rawLandlord || { id: landlordId, full_name_en: landlordName }} onReportSaved={onCallReportSaved} />
        </div>
      )}

      <CallsTabList calls={calls || []} />
    </div>
  );
}