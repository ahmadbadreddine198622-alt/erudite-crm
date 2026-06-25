import { useState, useRef, useEffect } from 'react';
import { Info, Brain, Target, CheckCircle2, ClipboardList, X } from 'lucide-react';
import { STAGE_GUIDE } from '@/lib/landlordStageGuide';

// "ℹ️ Stage Guide" — a small info button in the column header that opens a plain-English
// card with the stage's mindset / move / exit-rule / capture. Pure UI, reads static config.
export default function StageGuidePopover({ stage, accent = '#C9A24B' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const guide = STAGE_GUIDE[stage];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!guide) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="flex items-center justify-center w-5 h-5 rounded-md transition-colors hover:bg-white/10"
        style={{ color: accent }}
        title="Stage guide"
        aria-label="Stage guide"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 top-7 w-72 rounded-xl border shadow-2xl p-3.5 space-y-2.5"
          style={{ background: '#0B1F3A', borderColor: 'rgba(201,162,75,0.35)', boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold" style={{ color: accent }}>{guide.title}</h4>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{guide.meaning}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="shrink-0 text-white/40 hover:text-white/80 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <GuideRow icon={Brain} color="#c4b5fd" label="Landlord mindset" text={guide.mindset} />
          <GuideRow icon={Target} color="#fbbf24" label="My move" text={guide.move} />
          <GuideRow icon={CheckCircle2} color="#34d399" label="Move-on rule" text={guide.exitRule} />
          <GuideRow icon={ClipboardList} color="#93c5fd" label="Capture" text={guide.capture} />
        </div>
      )}
    </div>
  );
}

function GuideRow({ icon: Icon, color, label, text }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>{label}</p>
        <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.82)' }}>{text}</p>
      </div>
    </div>
  );
}