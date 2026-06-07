import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Check, X, Calendar, Clock, Bell, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

function Item({ icon: Icon, label, date, onComplete, onCancel, color = 'rgba(255,255,255,0.55)' }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3 h-3 shrink-0" style={{ color }} />
      <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      {date && <span className="text-[10px] text-muted-foreground shrink-0">{date}</span>}
      {onComplete && (
        <button onClick={onComplete} title="Complete" className="p-0.5 rounded hover:bg-emerald-500/20 transition-colors shrink-0">
          <Check className="w-3 h-3 text-emerald-400" />
        </button>
      )}
      {onCancel && (
        <button onClick={onCancel} title="Cancel" className="p-0.5 rounded hover:bg-red-500/20 transition-colors shrink-0">
          <X className="w-3 h-3 text-red-400" />
        </button>
      )}
    </div>
  );
}

export default function UpcomingStrip({ landlord }) {
  const [collapsed, setCollapsed] = useState(false);
  const qc = useQueryClient();

  const { data: followups = [] } = useQuery({
    queryKey: ['landlord-followups', landlord?.id],
    queryFn: () => base44.entities.Followup.filter({ landlord_id: landlord.id, status: 'pending' }, 'scheduled_at', 5),
    enabled: !!landlord?.id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['landlord-appointments', landlord?.id],
    queryFn: () => base44.entities.LandlordAppointment.filter({ landlord_id: landlord.id, status: 'scheduled' }, 'datetime', 3),
    enabled: !!landlord?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['landlord-tasks', landlord?.id],
    queryFn: () => base44.entities.LandlordTask.filter({ landlord_id: landlord.id, done: false }, 'due_date', 10),
    enabled: !!landlord?.id,
  });

  const completeFollowup = useMutation({
    mutationFn: (id) => base44.entities.Followup.update(id, { status: 'done' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['landlord-followups', landlord.id] }); toast.success('Marked done'); },
  });

  const completeAppt = useMutation({
    mutationFn: (id) => base44.entities.LandlordAppointment.update(id, { status: 'completed' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['landlord-appointments', landlord.id] }); toast.success('Appointment completed'); },
  });

  const nextFollowup = followups.find(f => !f.kind || f.kind === 'follow_up');
  const nextRenewal = followups.find(f => f.kind === 'renewal');
  const nextAppt = appointments[0];
  const openTaskCount = tasks.length;

  const isEmpty = !nextFollowup && !nextRenewal && !nextAppt && openTaskCount === 0;

  const fmtDate = (d) => { try { return d ? format(new Date(d), 'd MMM') : ''; } catch { return ''; } };

  if (isEmpty) return null;

  return (
    <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-3 flex-wrap flex-1 min-w-0 ${collapsed ? 'hidden' : ''}`}>
          {nextFollowup && (
            <Item
              icon={Calendar}
              label={nextFollowup.notes || nextFollowup.title || 'Follow-up'}
              date={fmtDate(nextFollowup.scheduled_at)}
              color="#60a5fa"
              onComplete={() => completeFollowup.mutate(nextFollowup.id)}
            />
          )}
          {nextAppt && (
            <Item
              icon={Clock}
              label={`${nextAppt.type} · ${nextAppt.location || ''}`}
              date={fmtDate(nextAppt.datetime)}
              color="#a78bfa"
              onComplete={() => completeAppt.mutate(nextAppt.id)}
            />
          )}
          {nextRenewal && (
            <Item
              icon={Bell}
              label={nextRenewal.notes || nextRenewal.title || 'Renewal'}
              date={fmtDate(nextRenewal.scheduled_at)}
              color="hsl(38 92% 55%)"
              onComplete={() => completeFollowup.mutate(nextRenewal.id)}
            />
          )}
          {openTaskCount > 0 && (
            <Item
              icon={CheckSquare}
              label={`${openTaskCount} open task${openTaskCount > 1 ? 's' : ''}`}
              color="#34d399"
            />
          )}
        </div>
        <button onClick={() => setCollapsed(c => !c)} className="p-1 rounded hover:bg-white/10 transition-colors shrink-0 ml-2">
          {collapsed
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </button>
      </div>
    </div>
  );
}