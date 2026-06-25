// Manual call-log form — writes a CallLog row for this landlord. Used by the
// "Log Call" header action. Minimal: direction, outcome, duration, notes.
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { GOLD } from './ccPrimitives';

const field = { padding: '8px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontFamily: 'Montserrat,sans-serif', width: '100%' };
const label = { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)', marginBottom: 4, display: 'block' };

export default function CCLogCallModal({ landlordId, phone, agentEmail, onLogged }) {
  const [direction, setDirection] = useState('outbound');
  const [status, setStatus] = useState('completed');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await base44.entities.CallLog.create({
        landlord_id: landlordId,
        direction,
        status,
        duration_seconds: minutes ? Math.round(parseFloat(minutes) * 60) : 0,
        from_number: direction === 'outbound' ? undefined : phone,
        to_number: direction === 'outbound' ? phone : undefined,
        agent_email: agentEmail || undefined,
        notes: notes.trim() || undefined,
        started_at: new Date().toISOString(),
      });
      toast.success('Call logged');
      onLogged?.();
    } catch (e) {
      toast.error('Failed to log call: ' + (e?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Direction</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
            <option value="outbound" style={{ background: '#0B1F3A' }}>Outbound</option>
            <option value="inbound" style={{ background: '#0B1F3A' }}>Inbound</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Outcome</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
            <option value="completed" style={{ background: '#0B1F3A' }}>Completed</option>
            <option value="no-answer" style={{ background: '#0B1F3A' }}>No answer</option>
            <option value="busy" style={{ background: '#0B1F3A' }}>Busy</option>
            <option value="voicemail" style={{ background: '#0B1F3A' }}>Voicemail</option>
          </select>
        </div>
        <div style={{ width: 90 }}>
          <label style={label}>Minutes</label>
          <input type="number" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" style={field} />
        </div>
      </div>
      <div>
        <label style={label}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What was discussed…" style={{ ...field, resize: 'vertical', minHeight: 70, lineHeight: 1.5 }} />
      </div>
      <button onClick={save} disabled={saving} style={{ padding: 11, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', background: `linear-gradient(180deg, ${GOLD}, #b08d3e)`, color: '#1a1205', border: 'none', fontFamily: 'Montserrat,sans-serif', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Logging…' : 'Log call'}
      </button>
    </div>
  );
}