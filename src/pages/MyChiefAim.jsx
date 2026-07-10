import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { toast } from 'sonner';
import { Flame, Loader2, Sparkles, X, Save } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import { GOLD, GOLD_LITE, pageWrap, card, goldStrip, serif, label, goldBtn, outlineBtn, input } from '@/lib/academyStyles';

function AffirmationModal({ open, onClose, text, userEmail, qc }) {
  const [affirming, setAffirming] = useState(false);

  useEffect(() => {
    if (open && text && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.82;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
      return () => window.speechSynthesis.cancel();
    }
  }, [open, text]);

  const handleAffirm = async () => {
    setAffirming(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const existing = await base44.entities.DailyAffirmationLog.filter({ user_email: userEmail, log_date: today });
      if (existing.length > 0) {
        toast.info('You already affirmed today. See you tomorrow.');
        onClose();
        return;
      }
      const priorLogs = await base44.entities.DailyAffirmationLog.filter({ user_email: userEmail }, '-log_date', 50);
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const hasYesterday = priorLogs.some(l => l.log_date === yesterday);
      const priorStreak = priorLogs[0]?.current_streak || 0;
      const priorLongest = priorLogs[0]?.longest_streak || 0;
      const currentStreak = hasYesterday ? priorStreak + 1 : 1;
      const longestStreak = Math.max(currentStreak, priorLongest);

      await base44.entities.DailyAffirmationLog.create({
        user_email: userEmail, log_date: today, affirmed: true, method: 'tap',
        affirmed_at: new Date().toISOString(), current_streak: currentStreak, longest_streak: longestStreak,
      });
      qc.invalidateQueries({ queryKey: ['academy-affirmations'] });
      toast.success(`Day ${currentStreak} affirmed. The streak continues.`);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Failed to log affirmation');
    } finally {
      setAffirming(false);
    }
  };

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'hsl(222 47% 6%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={18} />
      </button>
      <p style={{ ...label, color: GOLD, textAlign: 'center' }}>Morning Affirmation</p>
      <p style={{ ...serif, fontSize: 'clamp(22px, 4vw, 38px)', color: GOLD_LITE, textAlign: 'center', maxWidth: 680, lineHeight: 1.45, margin: '28px 0' }}>{text}</p>
      <button onClick={handleAffirm} disabled={affirming} style={{ ...goldBtn, fontSize: 16, padding: '14px 36px' }}>
        {affirming ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />} I AFFIRM
      </button>
    </div>
  );
}

export default function MyChiefAim() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [form, setForm] = useState({ aim_statement: '', target_figure_aed: '', target_date: '', service_rendered: '' });
  const [affirmation, setAffirmation] = useState('');
  const [forgeLoading, setForgeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { data: aims = [], isLoading } = useQuery({
    queryKey: ['academy-chief-aim', user?.email],
    queryFn: () => base44.entities.ChiefAim.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const aim = aims[0];

  // Sync form when aim loads
  useEffect(() => {
    if (aim) {
      setForm({
        aim_statement: aim.aim_statement || '',
        target_figure_aed: aim.target_figure_aed || '',
        target_date: aim.target_date || '',
        service_rendered: aim.service_rendered || '',
      });
      setAffirmation(aim.affirmation_text || '');
    }
  }, [aim?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleForge = async () => {
    if (!form.aim_statement.trim()) { toast.error('Write your chief aim first.'); return; }
    setForgeLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a first-person, present-tense daily affirmation (60-80 words) derived from this chief aim:\n\n"${form.aim_statement}"\n\nTarget: ${form.target_figure_aed || 'unspecified'} AED by ${form.target_date || 'unspecified'}. Service rendered: ${form.service_rendered || 'unspecified'}.\n\nRules: firm, dignified tone. No clichés. No exclamation marks. No "I will try" — only "I am" declarations. Return JSON { "affirmation": "..." }`,
        response_json_schema: { type: 'object', properties: { affirmation: { type: 'string' } } },
      });
      const text = res?.affirmation || (typeof res === 'string' ? res : '');
      if (text) { setAffirmation(text); toast.success('Affirmation forged.'); }
      else toast.error('Could not generate affirmation. Try again.');
    } catch (e) {
      toast.error(e?.message || 'AI generation failed');
    } finally {
      setForgeLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.aim_statement.trim()) { toast.error('Aim statement is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        user_email: user.email,
        aim_statement: form.aim_statement.trim(),
        target_figure_aed: form.target_figure_aed ? Number(form.target_figure_aed) : null,
        target_date: form.target_date || null,
        service_rendered: form.service_rendered.trim(),
        affirmation_text: affirmation.trim(),
        status: 'active',
        activated_date: new Date().toISOString().split('T')[0],
      };
      if (aim?.id) {
        await base44.entities.ChiefAim.update(aim.id, payload);
        toast.success('Chief Aim updated.');
      } else {
        await base44.entities.ChiefAim.create(payload);
        toast.success('Chief Aim forged.');
      }
      qc.invalidateQueries({ queryKey: ['academy-chief-aim'] });
    } catch (e) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
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
      <p style={{ ...label, color: GOLD }}>THE 17 · Module 02</p>
      <h1 style={{ ...serif, fontSize: 26, color: 'rgba(255,255,255,0.95)', margin: '2px 0 20px' }}>My Chief Aim</h1>

      {/* Aim form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={card}>
          <label style={{ ...label, display: 'block', marginBottom: 6 }}>Definite Chief Aim</label>
          <textarea value={form.aim_statement} onChange={e => set('aim_statement', e.target.value)} rows={4}
            placeholder="State your definite chief aim in clear, specific terms..."
            style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />

          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ ...label, display: 'block', marginBottom: 6 }}>Target Figure (AED)</label>
              <input type="number" value={form.target_figure_aed} onChange={e => set('target_figure_aed', e.target.value)} placeholder="500000" style={input} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ ...label, display: 'block', marginBottom: 6 }}>Target Date</label>
              <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} style={{ ...input, colorScheme: 'dark' }} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ ...label, display: 'block', marginBottom: 6 }}>Service Rendered</label>
            <input value={form.service_rendered} onChange={e => set('service_rendered', e.target.value)} placeholder="What value will you deliver to earn it?" style={input} />
          </div>
        </div>

        {/* Affirmation forge */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={label}>Daily Affirmation</label>
            <button onClick={handleForge} disabled={forgeLoading} style={{ ...outlineBtn, borderColor: 'rgba(212,175,55,0.35)', color: GOLD }}>
              {forgeLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Forge Affirmation
            </button>
          </div>
          <textarea value={affirmation} onChange={e => setAffirmation(e.target.value)} rows={5}
            placeholder="Your AI-forged affirmation will appear here. Edit before saving."
            style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={handleSave} disabled={saving} style={goldBtn}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {aim ? 'Update' : 'Save'} Chief Aim
            </button>
            {affirmation.trim() && (
              <button onClick={() => setShowModal(true)} style={{ ...goldBtn, background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))', color: GOLD_LITE, border: '1px solid rgba(212,175,55,0.4)' }}>
                <Flame size={15} /> Morning Affirmation
              </button>
            )}
          </div>
        </div>

        {/* Status */}
        {aim?.status === 'active' && (
          <div style={goldStrip}>
            <p style={{ ...label, color: GOLD }}>Status</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>✓ Active since {aim.activated_date}</p>
          </div>
        )}
      </div>

      <AffirmationModal open={showModal} onClose={() => setShowModal(false)} text={affirmation} userEmail={user?.email} qc={qc} />
    </div>
  );
}