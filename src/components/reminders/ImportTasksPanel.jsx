import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Download, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
const nanoid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);

function parseTasksFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines
    .filter(line => line.length > 3 && !line.startsWith('#'))
    .map(line => {
      // Strip leading bullets/dashes/numbers
      const cleaned = line.replace(/^[-•*\d+\.]\s*/, '').trim();
      if (!cleaned) return null;

      // Detect priority hints
      let priority = 'none';
      if (/urgent|asap|immediately/i.test(cleaned)) priority = 'urgent';
      else if (/important|high/i.test(cleaned)) priority = 'high';
      else if (/follow.?up/i.test(cleaned)) priority = 'medium';

      // Detect tags
      const tags = [];
      if (/follow.?up/i.test(cleaned)) tags.push('follow-up');
      if (/call/i.test(cleaned)) tags.push('call');
      if (/email/i.test(cleaned)) tags.push('email');
      if (/viewing/i.test(cleaned)) tags.push('viewing');
      if (/list/i.test(cleaned)) tags.push('listing');

      return {
        title: cleaned,
        priority,
        tags,
        status: 'pending',
        type: tags.includes('viewing') ? 'viewing' : tags.includes('follow-up') ? 'follow_up' : 'custom',
        source: 'imported',
        external_id: `import_${nanoid(8)}`,
        is_editable: true,
      };
    })
    .filter(Boolean);
}

export default function ImportTasksPanel({ onClose, existingTasks }) {
  const qc = useQueryClient();
  const [pastedText, setPastedText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState('paste'); // paste | preview | done

  const importMutation = useMutation({
    mutationFn: async (tasks) => {
      const existingTitles = new Set(existingTasks.map(t => t.title?.toLowerCase()));
      const existingExtIds = new Set(existingTasks.map(t => t.external_id).filter(Boolean));
      const newTasks = tasks.filter(t =>
        !existingTitles.has(t.title.toLowerCase()) &&
        !existingExtIds.has(t.external_id)
      );
      if (newTasks.length === 0) return { imported: 0, skipped: tasks.length };
      await base44.entities.Reminder.bulkCreate(newTasks);
      return { imported: newTasks.length, skipped: tasks.length - newTasks.length };
    },
    onSuccess: ({ imported, skipped }) => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      toast.success(`Imported ${imported} tasks${skipped > 0 ? `, ${skipped} skipped (duplicates)` : ''}`);
      setStep('done');
    },
    onError: () => toast.error('Import failed'),
  });

  const handleParse = () => {
    const tasks = parseTasksFromText(pastedText);
    if (tasks.length === 0) {
      toast.error('No tasks found in the pasted text');
      return;
    }
    setParsed(tasks);
    setSelected(tasks.map((_, i) => i));
    setStep('preview');
  };

  const handleImport = () => {
    const toImport = parsed.filter((_, i) => selected.includes(i));
    importMutation.mutate(toImport);
  };

  const toggleSelect = (i) => {
    setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F2F7]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
              <Download className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1C1C1E] text-sm">Import Tasks</h3>
              <p className="text-[10px] text-[#8E8E93]">Paste from Apple Reminders, Notion, or any list</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8E8E93] hover:text-[#1C1C1E] p-1 rounded-lg hover:bg-[#F2F2F7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'paste' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" /> How to import from Apple Reminders:</p>
                <ol className="list-decimal ml-4 space-y-0.5 text-blue-600">
                  <li>Open Apple Reminders on Mac or iPhone</li>
                  <li>Select your list (e.g., "To Do List")</li>
                  <li>Select all tasks (Cmd+A) and copy (Cmd+C)</li>
                  <li>Paste below — one task per line</li>
                </ol>
              </div>
              <Textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder={`Paste your tasks here, one per line:\n\nI need to follow up with the buyer\nCall Ahmad about unit 2209\nSchedule viewing for Marina Gate\n...`}
                className="min-h-[200px] text-sm font-mono resize-none"
                autoFocus
              />
              <Button
                onClick={handleParse}
                disabled={!pastedText.trim()}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                Parse Tasks
              </Button>
            </div>
          )}

          {step === 'preview' && parsed && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#1C1C1E]">{parsed.length} tasks found</p>
                <div className="flex gap-2">
                  <button onClick={() => setSelected(parsed.map((_, i) => i))} className="text-xs text-blue-500">All</button>
                  <button onClick={() => setSelected([])} className="text-xs text-[#8E8E93]">None</button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {parsed.map((task, i) => (
                  <div
                    key={i}
                    onClick={() => toggleSelect(i)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selected.includes(i)
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-[#E5E7EB] bg-white opacity-50'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected.includes(i) ? 'text-blue-500' : 'text-[#C7C7CC]'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#1C1C1E] leading-snug">{task.title}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {task.priority !== 'none' && (
                          <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full font-semibold">{task.priority}</span>
                        )}
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-[#F2F2F7]">
                <Button variant="outline" onClick={() => setStep('paste')} className="flex-1 text-sm">
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selected.length === 0 || importMutation.isPending}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm"
                >
                  {importMutation.isPending ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> Importing...</>
                  ) : (
                    `Import ${selected.length} Tasks`
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold text-[#1C1C1E]">Import Complete!</p>
              <p className="text-sm text-[#8E8E93]">Your tasks have been added to the CRM.</p>
              <Button onClick={onClose} className="bg-blue-500 hover:bg-blue-600 text-white mt-2">Done</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}