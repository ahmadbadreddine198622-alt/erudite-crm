import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Sparkles, Pencil, Trash2, Loader2, CheckSquare, Users, AlignLeft } from 'lucide-react';

const CATEGORY_LABEL = { deal: 'Deal', reference: 'Reference', personal: 'Personal', idea: 'Idea', other: 'Other' };
const CATEGORY_CLS   = { deal: 'jewel-gold', reference: 'jewel-blue', personal: 'jewel-purple', idea: 'jewel-emerald', other: 'jewel-slate' };

export default function NoteDetailSheet({ note, onClose, onEdit, onDelete, onAnalyze, analyzingId, onRefresh }) {
  const isAnalyzing = analyzingId === note?.id;
  const hasAI = !!note?.ai_summary;

  async function handleAnalyze() {
    await onAnalyze(note);
    await onRefresh();
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl bg-card border-border overflow-y-auto flex flex-col gap-5 p-6">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <span className={`jewel-pill ${CATEGORY_CLS[note?.category] || 'jewel-slate'} mb-2 inline-flex`}>
                {CATEGORY_LABEL[note?.category] || 'Other'}
              </span>
              <SheetTitle className="text-white/90 text-lg leading-snug">{note?.title || 'Untitled'}</SheetTitle>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-400" onClick={() => { onDelete(); onClose(); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Raw body */}
        <Section icon={<AlignLeft className="w-4 h-4" />} title="Note">
          <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{note?.body || '—'}</p>
        </Section>

        {/* Analyze button */}
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="gap-2 self-start"
          variant={hasAI ? 'outline' : 'default'}
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 gold-text" />}
          {isAnalyzing ? 'Analyzing with Claude…' : hasAI ? 'Re-analyze with Claude' : 'Analyze with Claude'}
        </Button>

        {/* AI results */}
        {hasAI && (
          <>
            <Section icon={<AlignLeft className="w-4 h-4 gold-text" />} title="AI Summary" accent>
              <p className="text-sm text-white/80 leading-relaxed">{note.ai_summary}</p>
            </Section>

            {note.ai_action_items?.length > 0 && (
              <Section icon={<CheckSquare className="w-4 h-4 gold-text" />} title="Action Items" accent>
                <ul className="space-y-1.5">
                  {note.ai_action_items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/80">
                      <span className="gold-text font-bold shrink-0">{i + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {note.ai_entities_mentioned?.length > 0 && (
              <Section icon={<Users className="w-4 h-4 gold-text" />} title="People &amp; Properties Mentioned" accent>
                <div className="flex flex-wrap gap-1.5">
                  {note.ai_entities_mentioned.map((e, i) => (
                    <span key={i} className="jewel-pill jewel-slate text-xs">{e}</span>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon, title, children, accent }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? 'bg-accent/8 border border-accent/20' : 'glass-card'}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">{title}</h3>
      </div>
      {children}
    </div>
  );
}