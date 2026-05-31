import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Plus, ChevronLeft, ChevronRight, Trash2, MessageSquare, CheckCircle, Users, XCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, subMonths, parseISO } from 'date-fns';

const STATUS_CONFIG = {
  pending:   { label: 'Scheduled', cls: 'jewel-amber' },
  sent:      { label: 'Sent',      cls: 'jewel-emerald' },
  failed:    { label: 'Failed',    cls: 'jewel-rose' },
  cancelled: { label: 'Cancelled', cls: 'jewel-slate' },
};

export default function WhatsAppScheduler() {
  const qc = useQueryClient();
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('calendar');

  const [form, setForm] = useState({
    recipient_phone: '',
    recipient_name: '',
    message_body: '',
    scheduled_at: '',
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['scheduled-messages'],
    queryFn: () => base44.entities.ScheduledMessage.list('-scheduled_at', 500),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-scheduler'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 200),
  });

  const create = useMutation({
    mutationFn: (data) => base44.entities.ScheduledMessage.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-messages'] });
      setShowForm(false);
      setForm({ recipient_phone: '', recipient_name: '', message_body: '', scheduled_at: '' });
    },
  });

  const cancel = useMutation({
    mutationFn: (id) => base44.entities.ScheduledMessage.update(id, { status: 'cancelled' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-messages'] }),
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.ScheduledMessage.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-messages'] }),
  });

  const days = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    const allDays = eachDayOfInterval({ start, end });
    const padDays = Array(start.getDay()).fill(null);
    return [...padDays, ...allDays];
  }, [calMonth]);

  const msgsByDay = useMemo(() => {
    const map = {};
    messages.forEach(m => {
      if (!m.scheduled_at) return;
      const key = format(parseISO(m.scheduled_at), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [messages]);

  const selectedDayMsgs = useMemo(() => {
    if (!selectedDay) return [];
    return messages.filter(m => m.scheduled_at && isSameDay(parseISO(m.scheduled_at), selectedDay));
  }, [selectedDay, messages]);

  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const sentCount = messages.filter(m => m.status === 'sent').length;
  const uniqueClients = new Set(messages.map(m => m.recipient_phone)).size;

  function handleSubmit(e) {
    e.preventDefault();
    const scheduledIso = form.scheduled_at ? new Date(form.scheduled_at).toISOString() : '';
    create.mutate({ ...form, scheduled_at: scheduledIso, status: 'pending' });
  }

  function fillFromLead(lead) {
    setForm(f => ({
      ...f,
      recipient_phone: lead.phone || lead.whatsapp || '',
      recipient_name: lead.full_name || '',
    }));
  }

  return (
    <div className="page-root">
      <div className="flex items-start justify-between mb-8 mt-8 md:mt-2">
        <div>
          <h1 className="page-title text-2xl md:text-3xl mb-1">WhatsApp Scheduler</h1>
          <p className="page-subtitle">Queue and calendar-manage scheduled messages for every client</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
        >
          <Plus className="w-4 h-4" />
          Schedule Message
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Clock,       label: 'Scheduled',      value: pendingCount,  cls: 'text-amber-400' },
          { icon: CheckCircle, label: 'Sent',            value: sentCount,     cls: 'text-emerald-400' },
          { icon: Users,       label: 'Unique Clients',  value: uniqueClients, cls: 'gold-text' },
        ].map(({ icon: Icon, label, value, cls }) => (
          <div key={label} className="glass-card p-4">
            <Icon className={`w-4 h-4 mb-2 ${cls}`} />
            <p className={`text-xl font-bold tabular-nums ${cls}`}>{value}</p>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 w-fit">
        {[['calendar','Calendar View'], ['queue','Message Queue']].map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-amber-500/20 text-amber-400' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-4 h-4 text-white/60" />
              </button>
              <h2 className="font-semibold text-white/90">{format(calMonth, 'MMMM yyyy')}</h2>
              <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <ChevronRight className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-white/30 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} />;
                const key = format(day, 'yyyy-MM-dd');
                const dayMsgs = msgsByDay[key] || [];
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`relative min-h-[52px] p-1 rounded-lg transition-all text-left ${
                      isSelected
                        ? 'bg-amber-500/20 border border-amber-500/50'
                        : 'hover:bg-white/5 border border-transparent'
                    } ${!isSameMonth(day, calMonth) ? 'opacity-30' : ''}`}
                  >
                    <span className={`text-xs font-semibold block text-center mb-1 w-6 h-6 rounded-full mx-auto leading-6 ${
                      isToday(day) ? 'bg-amber-500 text-black' : 'text-white/70'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {dayMsgs.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {dayMsgs.filter(m => m.status === 'pending').length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
                        {dayMsgs.filter(m => m.status === 'sent').length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                        {dayMsgs.filter(m => m.status === 'failed').length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        )}
                      </div>
                    )}
                    {dayMsgs.length > 0 && (
                      <span className="absolute bottom-0.5 right-1 text-[9px] text-white/40">{dayMsgs.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-semibold text-white/80 mb-4 text-sm">
              {selectedDay ? format(selectedDay, 'EEEE, MMMM d') : 'Select a day'}
            </h3>
            {!selectedDay && (
              <p className="text-white/30 text-sm">Click any day on the calendar to see scheduled messages.</p>
            )}
            {selectedDay && selectedDayMsgs.length === 0 && (
              <p className="text-white/30 text-sm">No messages scheduled for this day.</p>
            )}
            <div className="space-y-3">
              {selectedDayMsgs.map(msg => (
                <div key={msg.id} className="p-3 rounded-xl bg-white/5 border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white/80">{msg.recipient_name || msg.recipient_phone}</span>
                    <span className={`jewel-pill ${STATUS_CONFIG[msg.status]?.cls}`}>{STATUS_CONFIG[msg.status]?.label}</span>
                  </div>
                  <p className="text-xs text-white/50 mb-2">{format(parseISO(msg.scheduled_at), 'h:mm a')}</p>
                  <p className="text-xs text-white/70 line-clamp-2">{msg.message_body}</p>
                  {msg.status === 'pending' && (
                    <button
                      onClick={() => cancel.mutate(msg.id)}
                      className="mt-2 text-[10px] text-red-400 hover:text-red-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="glass-card overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-white/30">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No scheduled messages yet</p>
            </div>
          ) : (
            <table className="w-full glass-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Message</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {messages.map(msg => (
                  <tr key={msg.id}>
                    <td>
                      <p className="font-medium text-white/90">{msg.recipient_name || '—'}</p>
                      <p className="text-xs text-white/40">{msg.recipient_phone}</p>
                    </td>
                    <td className="max-w-xs">
                      <p className="truncate text-white/70">{msg.message_body}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      {msg.scheduled_at ? format(parseISO(msg.scheduled_at), 'MMM d, h:mm a') : '—'}
                    </td>
                    <td>
                      <span className={`jewel-pill ${STATUS_CONFIG[msg.status]?.cls}`}>
                        {STATUS_CONFIG[msg.status]?.label}
                      </span>
                    </td>
                    <td className="text-right">
                      {msg.status === 'pending' && (
                        <button onClick={() => cancel.mutate(msg.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400 mr-1">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(msg.status === 'cancelled' || msg.status === 'failed') && (
                        <button onClick={() => remove.mutate(msg.id)} className="p-1.5 rounded hover:bg-white/10 text-white/30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6">
            <h2 className="page-title text-lg mb-6">Schedule a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Quick-fill from lead (optional)</label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/80"
                  onChange={e => { const l = leads.find(x => x.id === e.target.value); if (l) fillFromLead(l); }}
                  defaultValue=""
                >
                  <option value="">Select lead...</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.full_name} — {l.phone || l.whatsapp}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Recipient Name</label>
                  <Input
                    value={form.recipient_name}
                    onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Phone (E.164) *</label>
                  <Input
                    value={form.recipient_phone}
                    onChange={e => setForm(f => ({ ...f, recipient_phone: e.target.value }))}
                    placeholder="+971501234567"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Scheduled Date and Time *</label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Message *</label>
                <textarea
                  value={form.message_body}
                  onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))}
                  placeholder="Type your message here..."
                  required
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg resize-none bg-white/5 border border-white/10 text-white/80 placeholder-white/30 focus:border-amber-500/40 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={create.isPending} className="flex-1 bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Clock className="w-4 h-4" />
                  {create.isPending ? 'Scheduling...' : 'Schedule Message'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}