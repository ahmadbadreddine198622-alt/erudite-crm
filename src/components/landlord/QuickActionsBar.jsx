import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addMonths, addYears } from 'date-fns';
import { Calendar, Clock, CheckSquare, ChevronDown, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery',
  listing_commitment: 'Listing Commitment',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Photographer Scheduling',
  listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Confirmation',
};

const STAGE_OPTIONS = Object.keys(STAGE_LABELS);

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-full max-w-md mx-4 rounded-2xl p-5 space-y-4" style={{ background: 'hsl(222 47% 11%)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.95)' }}>{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' };
const inputCls = "w-full px-3 py-2 text-sm rounded-lg";

// ─── Follow-Up Modal ───────────────────────────────────────────────────────
function FollowUpModal({ landlord, onClose }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [form, setForm] = useState({ date: '', time: '09:00', note: '', priority: 'normal' });

  const save = useMutation({
    mutationFn: () => {
      const dt = new Date(`${form.date}T${form.time}:00`);
      return base44.entities.Followup.create({
        landlord_id: landlord.id,
        scheduled_at: dt.toISOString(),
        notes: form.note,
        priority: form.priority,
        status: 'pending',
        agent_email: user?.email,
        kind: 'follow_up',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlord-followups', landlord.id] });
      toast.success('Follow-up scheduled');
      onClose();
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  return (
    <Modal title="📅 Schedule Follow-Up" onClose={onClose}>
      <FieldRow label="Date">
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Time (Dubai)">
        <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inputCls} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Priority">
        <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls} style={inputStyle}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </FieldRow>
      <FieldRow label="Note">
        <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3} className={`${inputCls} resize-none`} style={inputStyle} placeholder="What needs to happen…" />
      </FieldRow>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={!form.date || save.isPending} className="gap-1.5">
          {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Follow-Up
        </Button>
      </div>
    </Modal>
  );
}

// ─── Appointment Modal ────────────────────────────────────────────────────
function AppointmentModal({ landlord, onClose }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [form, setForm] = useState({ date: '', time: '10:00', duration: 30, type: 'call', location: '', notes: '' });

  const save = useMutation({
    mutationFn: () => {
      const dt = new Date(`${form.date}T${form.time}:00`);
      return base44.entities.LandlordAppointment.create({
        landlord_id: landlord.id,
        agent_email: user?.email,
        datetime: dt.toISOString(),
        duration_minutes: parseInt(form.duration) || 30,
        type: form.type,
        location: form.location,
        notes: form.notes,
        status: 'scheduled',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlord-appointments', landlord.id] });
      toast.success('Appointment saved — Google Calendar sync available via integrations.');
      onClose();
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  return (
    <Modal title="🗓 Book Appointment" onClose={onClose}>
      <FieldRow label="Date">
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Time (Dubai)">
        <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inputCls} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Duration (min)">
        <input type="number" min={15} step={15} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className={inputCls} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Type">
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls} style={inputStyle}>
          <option value="call">Call</option>
          <option value="viewing">Viewing</option>
          <option value="meeting">Meeting</option>
        </select>
      </FieldRow>
      <FieldRow label="Location">
        <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} style={inputStyle} placeholder={form.type === 'viewing' ? landlord?.unit_reference || 'Property address…' : 'Office / link…'} />
      </FieldRow>
      <FieldRow label="Notes">
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Additional notes…" />
      </FieldRow>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={!form.date || save.isPending} className="gap-1.5">
          {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Book
        </Button>
      </div>
    </Modal>
  );
}

// ─── Task Modal ────────────────────────────────────────────────────────────
function TaskModal({ landlord, onClose }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [form, setForm] = useState({ title: '', due_date: '', assignee_email: user?.email || '' });

  const save = useMutation({
    mutationFn: () => base44.entities.LandlordTask.create({
      landlord_id: landlord.id,
      title: form.title,
      due_date: form.due_date || undefined,
      assignee_email: form.assignee_email,
      done: false,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlord-tasks', landlord.id] });
      toast.success('Task created');
      onClose();
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  return (
    <Modal title="✅ Add Task" onClose={onClose}>
      <FieldRow label="Title">
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} style={inputStyle} placeholder="What needs to be done…" autoFocus />
      </FieldRow>
      <FieldRow label="Due date (optional)">
        <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Assignee">
        <input value={form.assignee_email} onChange={e => setForm(f => ({ ...f, assignee_email: e.target.value }))} className={inputCls} style={inputStyle} placeholder="email@erudite-estate.com" />
      </FieldRow>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={!form.title || save.isPending} className="gap-1.5">
          {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Create Task
        </Button>
      </div>
    </Modal>
  );
}

// ─── Renewal / Long-Horizon Reminder Modal ─────────────────────────────────
function RenewalModal({ landlord, onClose }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [preset, setPreset] = useState(null);

  const presets = [
    { label: '+3 months', date: format(addMonths(new Date(), 3), 'yyyy-MM-dd') },
    { label: '+6 months', date: format(addMonths(new Date(), 6), 'yyyy-MM-dd') },
    { label: '+1 year', date: format(addYears(new Date(), 1), 'yyyy-MM-dd') },
  ];

  const targetDate = preset?.date || custom;

  const save = useMutation({
    mutationFn: () => {
      const dt = new Date(targetDate + 'T09:00:00');
      return base44.entities.Followup.create({
        landlord_id: landlord.id,
        scheduled_at: dt.toISOString(),
        title: note || 'Renewal reminder',
        notes: note || 'Renewal reminder',
        priority: 'high',
        status: 'pending',
        agent_email: user?.email,
        kind: 'renewal',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlord-followups', landlord.id] });
      toast.success('Renewal reminder set — will surface automatically when due.');
      onClose();
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  return (
    <Modal title="♻️ Renewal / Long-Horizon Reminder" onClose={onClose}>
      <p className="text-xs text-muted-foreground -mt-1">This reminder will surface in the follow-up system when the date arrives.</p>
      <FieldRow label="When?">
        <div className="flex gap-2 flex-wrap">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { setPreset(p); setCustom(''); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={preset?.label === p.label
                ? { background: 'rgba(245,158,11,0.2)', color: 'hsl(38 92% 60%)', border: '1px solid rgba(245,158,11,0.4)' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Or choose a custom date">
        <input type="date" value={custom} onChange={e => { setCustom(e.target.value); setPreset(null); }} className={inputCls} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Note">
        <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} style={inputStyle} placeholder="Tenancy renewal, Form A expiry, Price review…" />
      </FieldRow>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={!targetDate || save.isPending} className="gap-1.5">
          {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Set Reminder
        </Button>
      </div>
    </Modal>
  );
}

// ─── Stage Update Dropdown ─────────────────────────────────────────────────
function StageDropdown({ landlord, onClose }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (stage) => base44.entities.Landlord.update(landlord.id, { stage }),
    onSuccess: (_, stage) => {
      qc.invalidateQueries({ queryKey: ['landlords'] });
      toast.success(`Stage → ${STAGE_LABELS[stage] || stage}`);
      onClose();
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-full max-w-xs mx-4 rounded-2xl overflow-hidden" style={{ background: 'hsl(222 47% 11%)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Update Stage</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">✕</button>
        </div>
        <div className="py-1">
          {STAGE_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => save.mutate(s)}
              disabled={save.isPending || landlord.stage === s}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/08 transition-colors disabled:opacity-40"
              style={{ color: landlord.stage === s ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.8)' }}
            >
              {landlord.stage === s ? '● ' : ''}{STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main QuickActionsBar ──────────────────────────────────────────────────
export default function QuickActionsBar({ landlord, onUpdate }) {
  const [modal, setModal] = useState(null); // 'followup' | 'appointment' | 'task' | 'stage' | 'renewal'
  const close = () => setModal(null);

  const actions = [
    { key: 'followup', label: '📅 Follow-Up', icon: Calendar },
    { key: 'appointment', label: '🗓 Appointment', icon: Clock },
    { key: 'task', label: '✅ Task', icon: CheckSquare },
    { key: 'stage', label: '📊 Stage', icon: ChevronDown },
    { key: 'renewal', label: '♻️ Renewal', icon: Bell },
  ];

  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
        {actions.map(a => (
          <button
            key={a.key}
            onClick={() => setModal(a.key)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {modal === 'followup' && <FollowUpModal landlord={landlord} onClose={close} />}
      {modal === 'appointment' && <AppointmentModal landlord={landlord} onClose={close} />}
      {modal === 'task' && <TaskModal landlord={landlord} onClose={close} />}
      {modal === 'stage' && <StageDropdown landlord={landlord} onClose={close} />}
      {modal === 'renewal' && <RenewalModal landlord={landlord} onClose={close} />}
    </>
  );
}