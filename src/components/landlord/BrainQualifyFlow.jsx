import React, { useState, useMemo, useEffect } from 'react';
import { QUESTION_BANK } from './qualifyQuestionBank';
import BrainCoachSection from './BrainCoachSection';
import QuickDumpBar from './QuickDumpBar';
import WritingField from '@/components/shared/WritingField';
import {
  Brain, Loader2, ChevronLeft, ChevronRight, CheckCircle2,
  PhoneCall, ChevronDown, ChevronUp, Lightbulb, SkipForward,
} from 'lucide-react';

const AI_BLUE = 'rgba(96,165,250,';
const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' };

// ── Question Step (inline sub-component) ─────────────────────────────────────

function QuestionStep({ q, form, onAnswer, aiDetected }) {
  if (!q) return null;
  const Icon = q.Icon;
  const currentValue = form[q.field_key];
  const isAnswered = !!currentValue;

  return (
    <div className="rounded-xl border p-3.5 space-y-2.5" style={{
      background: aiDetected ? 'rgba(212,175,55,0.06)' : `${AI_BLUE}0.05)`,
      borderColor: aiDetected ? 'rgba(212,175,55,0.45)' : `${AI_BLUE}0.2)`,
      boxShadow: aiDetected ? '0 0 14px rgba(212,175,55,0.15)' : 'none',
      transition: 'all 0.4s ease',
    }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${AI_BLUE}0.15)` }}>
          <Icon className="w-4 h-4" style={{ color: `${AI_BLUE}0.9)` }} />
        </div>
        <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{q.area}</span>
        {isAnswered && (
          <span className="flex items-center gap-1 text-[10px] font-semibold ml-auto" style={{ color: aiDetected ? '#d4af37' : '#34d399' }}>
            <CheckCircle2 className="w-3 h-3" /> {aiDetected ? 'AI-detected — tap to confirm' : 'Answered'}
          </span>
        )}
      </div>

      {/* Question */}
      <p className="text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>{q.question}</p>

      {/* Why */}
      {q.why && (
        <p className="text-[10px] italic leading-snug flex gap-1.5" style={{ color: `${AI_BLUE}0.55)` }}>
          <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" /> {q.why}
        </p>
      )}

      {/* Choice chips */}
      {q.input_type === 'choice' && (
        <div className="flex flex-wrap gap-2 pt-1">
          {q.options.map(opt => {
            const selected = currentValue === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onAnswer(q.field_key, opt.value)}
                className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
                style={{
                  background: selected ? `${AI_BLUE}0.25)` : 'rgba(255,255,255,0.05)',
                  color: selected ? `${AI_BLUE}0.95)` : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${selected ? `${AI_BLUE}0.4)` : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {selected && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Number input */}
      {q.input_type === 'number' && (
        <div className="flex items-center gap-2">
          {q.prefix && <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>{q.prefix}</span>}
          <input
            type="number"
            value={form[q.field_key] || ''}
            onChange={e => onAnswer(q.field_key, e.target.value)}
            placeholder={q.placeholder || ''}
            className="flex-1 px-3 py-2 rounded-lg text-xs"
            style={inputStyle}
          />
        </div>
      )}

      {/* Text input */}
      {q.input_type === 'text' && (
        <input
          type="text"
          value={form[q.field_key] || ''}
          onChange={e => onAnswer(q.field_key, e.target.value)}
          placeholder={q.placeholder || ''}
          className="w-full px-3 py-2 rounded-lg text-xs"
          style={inputStyle}
        />
      )}

      {/* Date input */}
      {q.input_type === 'date' && (
        <input
          type="date"
          value={form[q.field_key] || ''}
          onChange={e => onAnswer(q.field_key, e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs"
          style={inputStyle}
        />
      )}

      {/* Notes field (for motivation) */}
      {q.notes_field && (
        <div className="pt-1">
          <input
            type="text"
            value={form[q.notes_field] || ''}
            onChange={e => onAnswer(q.notes_field, e.target.value)}
            placeholder={q.notes_label || 'Notes…'}
            className="w-full px-3 py-2 rounded-lg text-xs"
            style={inputStyle}
          />
        </div>
      )}
    </div>
  );
}

// ── All Fields Summary (inline sub-component) ────────────────────────────────

function FieldsSummary({ form, onJump }) {
  const [open, setOpen] = useState(false);
  const answered = QUESTION_BANK.filter(q => !!form[q.field_key]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
            All Fields ({answered.length}/{QUESTION_BANK.length})
          </span>
          <div className="flex gap-0.5">
            {QUESTION_BANK.map(q => (
              <div key={q.field_key} className="w-1.5 h-1.5 rounded-full" style={{
                background: form[q.field_key] ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.1)',
              }} />
            ))}
          </div>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {QUESTION_BANK.map((q, i) => {
            const val = form[q.field_key];
            return (
              <button
                key={q.field_key}
                onClick={() => { onJump(i); setOpen(false); }}
                className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-white/5 transition-colors text-left"
              >
                {val
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  : <div className="w-3 h-3 rounded-full border shrink-0" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />}
                <span className="text-[10px] shrink-0 w-28" style={{ color: 'rgba(255,255,255,0.4)' }}>{q.area}</span>
                <span className="text-[10px] truncate" style={{ color: val ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}>
                  {val || '—'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BrainQualifyFlow({ form, set, setForm, landlord, aiKeys, onSave, saving, reportLoading, saved }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flash, setFlash] = useState(false);

  const answeredCount = useMemo(() => QUESTION_BANK.filter(q => !!form[q.field_key]).length, [form]);
  const progress = Math.round((answeredCount / QUESTION_BANK.length) * 100);
  const current = QUESTION_BANK[currentIndex];
  const allDone = answeredCount === QUESTION_BANK.length;

  const handleAnswer = (field_key, value) => {
    set(field_key, value);
    // Brief flash, then auto-advance for choice inputs
    if (field_key === current?.field_key) {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      if (current?.input_type === 'choice' && !current?.notes_field) {
        setTimeout(() => setCurrentIndex(i => Math.min(i + 1, QUESTION_BANK.length - 1)), 450);
      }
    }
  };

  const goPrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex(i => Math.min(QUESTION_BANK.length - 1, i + 1));
  const jumpToNextUnanswered = () => {
    const next = QUESTION_BANK.findIndex(q => !form[q.field_key]);
    if (next !== -1) setCurrentIndex(next);
  };

  return (
    <div className="space-y-3">
      {/* ── Header with progress ── */}
      <div className="rounded-xl border overflow-hidden" style={{ background: `${AI_BLUE}0.06)`, borderColor: `${AI_BLUE}0.2)` }}>
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${AI_BLUE}0.18)` }}>
            <Brain className="w-5 h-5" style={{ color: `${AI_BLUE}0.95)` }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold" style={{ color: `${AI_BLUE}0.95)`, fontFamily: 'var(--font-display)' }}>
              🧠 Brain Qualify
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {allDone
                ? '✅ All areas qualified — ready to save'
                : `${answeredCount} of ${QUESTION_BANK.length} qualified — ${QUESTION_BANK.length - answeredCount} to go`}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 mx-3.5 mb-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: allDone
                ? 'linear-gradient(90deg, rgba(16,185,129,0.8), rgba(16,185,129,0.5))'
                : `linear-gradient(90deg, ${AI_BLUE}0.8), ${AI_BLUE}0.5))`,
            }}
          />
        </div>
      </div>

      {/* ── Brain Coach (AI) ── */}
      <BrainCoachSection landlord={landlord} form={form} answeredCount={answeredCount} />

      {/* ── Question Wizard ── */}
      <div className="relative">
        {flash && (
          <div className="absolute inset-0 rounded-xl pointer-events-none z-10" style={{
            background: 'radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, transparent 70%)',
            animation: 'page-rise 0.4s ease-out',
          }} />
        )}
        <QuestionStep q={current} form={form} onAnswer={handleAnswer} aiDetected={!!(aiKeys && current && aiKeys.has(current.field_key) && form[current.field_key])} />

        {/* Navigation */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="flex-1 text-center text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {currentIndex + 1} / {QUESTION_BANK.length}
          </div>

          {!allDone && (
            <button
              onClick={jumpToNextUnanswered}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors"
              style={{ background: `${AI_BLUE}0.1)`, color: `${AI_BLUE}0.85)`, border: `1px solid ${AI_BLUE}0.25)` }}
              title="Jump to next unanswered question"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip to next
            </button>
          )}

          <button
            onClick={goNext}
            disabled={currentIndex === QUESTION_BANK.length - 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Quick Dump (alternative path) ── */}
      <QuickDumpBar form={form} setForm={setForm} landlord={landlord} />

      {/* ── All Fields Summary ── */}
      <FieldsSummary form={form} onJump={setCurrentIndex} />

      {/* ── Agent Notes ── */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Agent Notes
        </label>
        <WritingField
          value={form.agent_notes || ''}
          onChange={e => set('agent_notes', e.target.value)}
          placeholder="Internal notes, observations, strategy…"
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-xs resize-none"
          style={inputStyle}
          landlordId={landlord?.id}
          channel="note"
        />
      </div>

      {/* ── Save Button ── */}
      <button
        onClick={onSave}
        disabled={saving || reportLoading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
        style={{
          background: saved ? 'rgba(16,185,129,0.2)' : allDone ? 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))' : 'rgba(250,180,40,0.15)',
          color: saved ? '#34d399' : allDone ? 'hsl(222 47% 11%)' : 'hsl(38 92% 60%)',
          border: saved ? '1px solid rgba(16,185,129,0.4)' : allDone ? '1px solid hsl(38 92% 50% / 0.5)' : '1px solid rgba(250,180,40,0.3)',
          boxShadow: allDone && !saved ? '0 4px 20px rgba(250,180,40,0.2)' : 'none',
        }}
      >
        {saving
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : reportLoading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Building AI report…</>
          : saved
          ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
          : <><PhoneCall className="w-4 h-4" /> {allDone ? 'Save Call & Build Report' : `Save Call (${answeredCount}/${QUESTION_BANK.length})`}</>}
      </button>
    </div>
  );
}