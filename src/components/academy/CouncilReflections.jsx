import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { toast } from 'sonner';
import { Loader2, Send, Sparkles } from 'lucide-react';
import ReadAloudButton from '@/components/shared/ReadAloudButton';
import DictationMicButton from '@/components/shared/DictationMicButton';
import { GOLD, GOLD_LITE, card, goldStrip, serif, label, goldBtn, input, rankPill } from '@/lib/academyStyles';

export default function CouncilReflections() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['academy-enrollment', user?.email],
    queryFn: () => base44.entities.TrainingEnrollment.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const enrollment = enrollments[0];

  const { data: principles = [] } = useQuery({
    queryKey: ['academy-principles'],
    queryFn: async () => {
      const all = await base44.entities.TrainingPrinciple.list('week_number', 50);
      return all.filter(p => p.slug);
    },
  });
  const currentPrinciple = enrollment ? principles.find(p => p.week_number === enrollment.current_week) : null;

  const { data: reflections = [] } = useQuery({
    queryKey: ['academy-reflections', user?.email],
    queryFn: () => base44.entities.TrainingReflection.filter({ user_email: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  const handleSubmit = async () => {
    if (!text.trim()) { toast.error('Write your reflection first.'); return; }
    if (!enrollment) { toast.error('Enroll in THE 17 first.'); return; }
    setSubmitting(true);
    try {
      const weekNum = enrollment.current_week;
      const ref = await base44.entities.TrainingReflection.create({
        user_email: user.email,
        agent_name: user.display_name || user.full_name || user.email,
        week_number: weekNum,
        reflection_text: text.trim(),
      });

      const principle = principles.find(p => p.week_number === weekNum);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a firm, warm mentor in the Grant Cardone tradition. Grade this training reflection for Week ${weekNum}: "${principle?.name || ''}".\n\nReflection:\n"${text.trim()}"\n\nScore 0-100 for depth and real application. Write 3-4 sentences of feedback referencing what the agent actually wrote. Be direct but encouraging. Return JSON { "ai_score": number, "ai_feedback": "..." }`,
        response_json_schema: { type: 'object', properties: { ai_score: { type: 'number' }, ai_feedback: { type: 'string' } } },
      });
      const aiScore = res?.ai_score ?? 0;
      const aiFeedback = res?.ai_feedback || '';
      await base44.entities.TrainingReflection.update(ref.id, { ai_score: aiScore, ai_feedback: aiFeedback });

      // Save principle score snapshot
      await base44.entities.PrincipleScoreSnapshot.create({
        user_email: user.email,
        agent_name: user.display_name || user.full_name || user.email,
        week_number: weekNum,
        score: aiScore,
        snapshot_date: new Date().toISOString().split('T')[0],
      });

      const completed = Array.isArray(enrollment.weeks_completed) ? [...enrollment.weeks_completed] : [];
      if (!completed.includes(weekNum)) completed.push(weekNum);
      const nextWeek = Math.min(weekNum + 1, 17);
      const rankTitle = principle?.rank_title || null;
      await base44.entities.TrainingEnrollment.update(enrollment.id, {
        weeks_completed: completed,
        current_week: nextWeek,
        rank: rankTitle,
        status: nextWeek > 17 ? 'completed' : 'active',
      });

      qc.invalidateQueries({ queryKey: ['academy-reflections'] });
      qc.invalidateQueries({ queryKey: ['academy-enrollment'] });
      qc.invalidateQueries({ queryKey: ['academy-scores'] });
      setText('');
      toast.success(`Week ${weekNum} complete. ${nextWeek > 17 ? 'You have completed THE 17.' : `Advanced to Week ${nextWeek}.`}`);
    } catch (e) {
      toast.error(e?.message || 'Failed to submit reflection');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
      <Loader2 className="animate-spin" style={{ color: GOLD }} size={24} />
    </div>
  );

  if (!enrollment) return (
    <div style={goldStrip}>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Enroll in THE 17 to submit reflections.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Current week reflection prompt */}
      {currentPrinciple && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ ...serif, fontSize: 28, color: GOLD }}>{enrollment.current_week}</span>
            <h2 style={{ ...serif, fontSize: 20, color: GOLD_LITE }}>{currentPrinciple.name}</h2>
          </div>
          {currentPrinciple.reflection_prompt && (
            <div style={goldStrip}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ ...label, color: GOLD }}>Reflection Prompt</p>
                <ReadAloudButton text={currentPrinciple.reflection_prompt} title={`Reflection: ${currentPrinciple.name}`} />
              </div>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.88)', marginTop: 4, fontStyle: 'italic' }}>{currentPrinciple.reflection_prompt}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
              placeholder="Write your reflection here. Be honest about what you did, what worked, what didn't..."
              style={{ ...input, resize: 'vertical', lineHeight: 1.6, marginTop: 12, flex: 1 }} />
            <DictationMicButton value={text} onChange={setText} size={16} style={{ marginBottom: 4 }} />
          </div>
          <button onClick={handleSubmit} disabled={submitting} style={{ ...goldBtn, marginTop: 12 }}>
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit & Complete Week
          </button>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>AI will grade your reflection for depth and real application.</p>
        </div>
      )}

      {/* Past reflections */}
      {reflections.length > 0 && (
        <div>
          <h3 style={{ ...serif, fontSize: 18, color: 'rgba(255,255,255,0.9)', marginBottom: 10 }}>Past Reflections</h3>
          {reflections.map(r => (
            <div key={r.id} style={{ ...card, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ ...serif, fontSize: 18, color: GOLD }}>W{r.week_number}</span>
                {r.ai_score != null && (
                  <span style={{ ...rankPill, background: r.ai_score >= 75 ? 'rgba(52,211,153,0.12)' : r.ai_score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', borderColor: r.ai_score >= 75 ? 'rgba(52,211,153,0.3)' : r.ai_score >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)', color: r.ai_score >= 75 ? '#34d399' : r.ai_score >= 50 ? GOLD_LITE : '#f87171' }}>
                    Score: {r.ai_score}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, marginBottom: 8 }}>{r.reflection_text}</p>
              {r.ai_feedback && (
                <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ ...label, color: GOLD, display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles size={11} /> Mentor Feedback</p>
                    <ReadAloudButton text={r.ai_feedback} title={`Feedback: Week ${r.week_number}`} size={12} />
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 1.5 }}>{r.ai_feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}