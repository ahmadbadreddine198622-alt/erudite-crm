import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, RefreshCw, Compass, Building, User, Sparkles } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import ReadAloudButton from '@/components/shared/ReadAloudButton';
import { GOLD, GOLD_LITE, pageWrap, card, goldStrip, serif, label, outlineBtn } from '@/lib/academyStyles';

const OPEN_DEAL_STAGES = ['discovery', 'qualified', 'viewing', 'offer_drafting', 'offer_submitted', 'negotiating', 'agreement', 'diligence', 'noc_signing', 'closing'];

export default function TheField() {
  const { user } = useCurrentUser();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const { data: enrollments = [] } = useQuery({
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

  const generateSuggestions = useCallback(async () => {
    if (!currentPrinciple || !user?.email) return;
    setLoading(true);
    setSuggestions([]);
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const [deals, landlords] = await Promise.all([
        base44.entities.Deal.filter({ assigned_agent_email: user.email }),
        base44.entities.Landlord.filter({ assigned_agent_email: user.email }),
      ]);

      // Filter: open deals with no activity in 7+ days
      const staleDeals = deals
        .filter(d => OPEN_DEAL_STAGES.includes(d.stage) && d.updated_date && new Date(d.updated_date).getTime() < sevenDaysAgo)
        .map(d => ({
          type: 'deal',
          name: d.lead_name || d.deal_reference || d.property_ref || 'Untitled deal',
          stage: d.stage || 'unknown',
          detail: d.deal_value ? `${d.deal_value.toLocaleString()} AED` : '',
          updated: d.updated_date,
        }));

      // Filter: landlords with no activity in 7+ days
      const staleLandlords = landlords
        .filter(l => l.updated_date && new Date(l.updated_date).getTime() < sevenDaysAgo)
        .map(l => ({
          type: 'landlord',
          name: l.full_name_en || l.first_name || 'Unknown landlord',
          stage: l.stage || 'unknown',
          detail: l.unit_reference || l.project_name || '',
          updated: l.updated_date,
        }));

      // Combine, sort oldest-first, take 5
      const stale = [...staleDeals, ...staleLandlords]
        .sort((a, b) => new Date(a.updated).getTime() - new Date(b.updated).getTime())
        .slice(0, 5);

      if (stale.length === 0) {
        setSuggestions([]);
        return;
      }

      // Generate one suggested move per item via InvokeLLM (parallel)
      const results = await Promise.all(stale.map(async (item) => {
        try {
          const res = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a real estate sales coach in the Grant Cardone tradition — direct, aggressive, 10X mindset.

This week's training principle is: "${currentPrinciple.name}"
Principle essence: "${currentPrinciple.essence || currentPrinciple.tagline || ''}"

Here is a ${item.type} in the agent's pipeline that has had no activity for 7+ days:
Name: ${item.name}
Stage: ${item.stage}
${item.detail ? `Detail: ${item.detail}` : ''}

Generate ONE specific, actionable move the agent should make TODAY, framed through the lens of "${currentPrinciple.name}". Be direct, specific, and aggressive. 2-3 sentences max. No preamble — just the move.`,
          });
          const text = typeof res === 'string' ? res : (res?.response || res?.text || '');
          return { ...item, suggestion: text || 'No suggestion generated.' };
        } catch {
          return { ...item, suggestion: 'Failed to generate suggestion.' };
        }
      }));
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [currentPrinciple, user?.email]);

  return (
    <div style={pageWrap}>
      <AcademyNav />
      <p style={{ ...label, color: GOLD }}>where we live it</p>
      <h1 style={{ ...serif, fontSize: 26, color: GOLD_LITE, margin: '2px 0 20px' }}>THE FIELD</h1>

      {!enrollment ? (
        <div style={goldStrip}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Enroll in THE 17 to access The Field.</p>
        </div>
      ) : currentPrinciple ? (
        <>
          {/* Directive gold strip */}
          {currentPrinciple.directive_text && (
            <div style={goldStrip}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ ...label, color: GOLD }}>Week {enrollment.current_week} Directive</p>
                <ReadAloudButton text={currentPrinciple.directive_text} title={`Directive: Week ${enrollment.current_week}`} />
              </div>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4, lineHeight: 1.5 }}>{currentPrinciple.directive_text}</p>
            </div>
          )}

          {/* Principle in your pipeline */}
          <div style={{ ...card, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={label}>Principle in Your Pipeline</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Stale deals & landlords (7+ days idle) viewed through "{currentPrinciple.name}"</p>
              </div>
              <button onClick={generateSuggestions} disabled={loading} style={{ ...outlineBtn, borderColor: 'rgba(212,175,55,0.35)', color: GOLD }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
              </button>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Loader2 className="animate-spin" style={{ color: GOLD }} size={24} />
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Scanning your pipeline…</p>
              </div>
            )}

            {!loading && suggestions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Compass size={24} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto' }} />
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Click Refresh to scan your pipeline for stale deals and landlords, then apply this week's principle.</p>
              </div>
            )}

            {suggestions.map((s, i) => (
              <div key={i} style={{ ...card, marginTop: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {s.type === 'deal' ? <Building size={14} style={{ color: GOLD }} /> : <User size={14} style={{ color: GOLD }} />}
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>{s.type} · {s.stage}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Sparkles size={13} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, flex: 1 }}>{s.suggestion}</p>
                  <ReadAloudButton text={s.suggestion} title={`Move: ${s.name}`} size={13} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={card}>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading your week's principle…</p>
        </div>
      )}
    </div>
  );
}