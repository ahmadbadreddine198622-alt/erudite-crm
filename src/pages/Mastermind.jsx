import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { toast } from 'sonner';
import { Loader2, Plus, Sparkles, X, Users, Calendar } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import { GOLD, GOLD_LITE, pageWrap, card, goldStrip, serif, label, goldBtn, outlineBtn, input, rankPill } from '@/lib/academyStyles';

export default function Mastermind() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', session_date: '', week_number: '', attendees: [],
    agenda: '', wins: '', commitments: '', notes: '',
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['academy-sessions'],
    queryFn: () => base44.entities.MastermindSession.list('-session_date', 50),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['academy-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['academy-enrollment', user?.email],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const enrollment = enrollments[0];

  const { data: principles = [] } = useQuery({
    queryKey: ['academy-principles'],
    queryFn: () => base44.entities.TrainingPrinciple.list('week_number', 20),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (enrollment && !form.week_number) {
      set('week_number', enrollment.current_week);
    }
  }, [enrollment?.id]);

  const toggleAttendee = (email) => {
    set('attendees', form.attendees.includes(email)
      ? form.attendees.filter(e => e !== email)
      : [...form.attendees, email]);
  };

  const handleGenerateAgenda = async () => {
    const weekNum = form.week_number || enrollment?.current_week || 1;
    const principle = principles.find(p => p.week_number === weekNum);
    if (!principle) { toast.error('Principle not found for this week.'); return; }
    setAgendaLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a mastermind session agenda for Week ${weekNum}: "${principle.name}".\n\nPrinciple essence: ${principle.essence || principle.tagline || ''}\n\nStructure the agenda as:\n1. Opening principle recap (2-3 sentences connecting the principle to the team's work)\n2. Round of wins (each member shares one win from the week)\n3. Stuck-file clinic (members bring deals/leads that are stuck; the group problem-solves)\n4. Commitments with owners and deadlines (each member commits to one specific action before next session)\n\nReturn JSON { "agenda": "..." } with the agenda as formatted text using line breaks.`,
        response_json_schema: { type: 'object', properties: { agenda: { type: 'string' } } },
      });
      const agenda = res?.agenda || (typeof res === 'string' ? res : '');
      if (agenda) { set('agenda', agenda); toast.success('Agenda generated.'); }
      else toast.error('Could not generate agenda.');
    } catch (e) {
      toast.error(e?.message || 'AI generation failed');
    } finally {
      setAgendaLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.session_date) { toast.error('Title and date are required.'); return; }
    try {
      await base44.entities.MastermindSession.create({
        title: form.title.trim(),
        session_date: form.session_date,
        week_number: form.week_number ? Number(form.week_number) : null,
        attendees: form.attendees,
        agenda: form.agenda.trim(),
        wins: form.wins.trim(),
        commitments: form.commitments.trim(),
        notes: form.notes.trim(),
        status: 'scheduled',
        created_by_email: user.email,
      });
      qc.invalidateQueries({ queryKey: ['academy-sessions'] });
      toast.success('Session created.');
      setShowForm(false);
      setForm({ title: '', session_date: '', week_number: enrollment?.current_week || '', attendees: [], agenda: '', wins: '', commitments: '', notes: '' });
    } catch (e) {
      toast.error(e?.message || 'Failed to create session');
    }
  };

  if (isLoading) return (
    <div style={{ ...pageWrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" style={{ color: GOLD }} size={32} />
    </div>
  );

  return (
    <div style={pageWrap}>
      <AcademyNav />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <p style={{ ...label, color: GOLD }}>THE 17 · Module 05</p>
          <h1 style={{ ...serif, fontSize: 26, color: 'rgba(255,255,255,0.95)', margin: '2px 0 0' }}>Mastermind</h1>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={goldBtn}>
          {showForm ? <X size={15} /> : <Plus size={15} />} {showForm ? 'Cancel' : 'New Session'}
        </button>
      </div>

      {showForm && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ ...label, display: 'block', marginBottom: 5 }}>Title</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Week 3 Mastermind" style={input} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ ...label, display: 'block', marginBottom: 5 }}>Date</label>
              <input type="date" value={form.session_date} onChange={e => set('session_date', e.target.value)} style={{ ...input, colorScheme: 'dark' }} />
            </div>
            <div style={{ flex: '0 1 100px' }}>
              <label style={{ ...label, display: 'block', marginBottom: 5 }}>Week #</label>
              <input type="number" value={form.week_number} onChange={e => set('week_number', e.target.value)} min={1} max={17} style={input} />
            </div>
          </div>

          {/* Attendees */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...label, display: 'block', marginBottom: 6 }}>Attendees</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {users.map(u => {
                const selected = form.attendees.includes(u.email);
                return (
                  <button key={u.id} type="button" onClick={() => toggleAttendee(u.email)}
                    style={{
                      padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                      background: selected ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                      border: selected ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.1)',
                      color: selected ? GOLD_LITE : 'rgba(255,255,255,0.5)',
                    }}>
                    {u.display_name || u.full_name || u.email}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agenda */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={label}>Agenda</label>
              <button type="button" onClick={handleGenerateAgenda} disabled={agendaLoading} style={{ ...outlineBtn, borderColor: 'rgba(212,175,55,0.35)', color: GOLD }}>
                {agendaLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate Agenda
              </button>
            </div>
            <textarea value={form.agenda} onChange={e => set('agenda', e.target.value)} rows={6} placeholder="Agenda will appear here when generated, or write your own..." style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ ...label, display: 'block', marginBottom: 5 }}>Wins</label>
              <textarea value={form.wins} onChange={e => set('wins', e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ ...label, display: 'block', marginBottom: 5 }}>Commitments</label>
              <textarea value={form.commitments} onChange={e => set('commitments', e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ ...label, display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} />
          </div>

          <button onClick={handleSave} style={goldBtn}>Create Session</button>
        </div>
      )}

      {/* Sessions list */}
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.length === 0 && !showForm && (
          <div style={card}>
            <p style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>No mastermind sessions yet. Create one to get started.</p>
          </div>
        )}
        {sessions.map(s => (
          <div key={s.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Calendar size={14} style={{ color: GOLD }} />
              <h3 style={{ ...serif, fontSize: 18, color: GOLD_LITE, margin: 0, flex: 1 }}>{s.title}</h3>
              {s.week_number && <span style={rankPill}>Week {s.week_number}</span>}
              <span style={{ ...rankPill, background: s.status === 'completed' ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)', borderColor: s.status === 'completed' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)', color: s.status === 'completed' ? '#34d399' : GOLD_LITE }}>{s.status}</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            {s.attendees?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                <Users size={12} style={{ color: 'rgba(255,255,255,0.35)' }} />
                {s.attendees.map((a, i) => (
                  <span key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{a}{i < s.attendees.length - 1 ? ',' : ''}</span>
                ))}
              </div>
            )}
            {s.agenda && (
              <div style={{ background: 'rgba(212,175,55,0.05)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                <p style={{ ...label, color: GOLD }}>Agenda</p>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, fontFamily: "'Inter',sans-serif", margin: '4px 0 0' }}>{s.agenda}</pre>
              </div>
            )}
            {s.wins && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}><strong style={{ color: GOLD }}>Wins:</strong> {s.wins}</p>}
            {s.commitments && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}><strong style={{ color: GOLD }}>Commitments:</strong> {s.commitments}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}