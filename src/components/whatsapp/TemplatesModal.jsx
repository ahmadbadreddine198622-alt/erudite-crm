import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, BarChart2, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";

// Extract {{variable_name}} placeholders from body
function extractVariables(body) {
  if (!body) return [];
  const matches = [...body.matchAll(/\{\{([^}]+)\}\}/g)];
  return [...new Set(matches.map(m => m[1]))];
}

// Highlight {{variables}} in body text
function renderBody(body) {
  if (!body) return null;
  const parts = body.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{/.test(part)
      ? <span key={i} className="font-semibold" style={{ color: 'hsl(38 92% 60%)' }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

function categoryColor(cat) {
  if (cat === "MARKETING") return "text-pink-400";
  if (cat === "UTILITY") return "text-blue-400";
  if (cat === "AUTHENTICATION") return "text-amber-400";
  return "text-gray-400";
}

function TemplateRow({ t, onSend }) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const vars = extractVariables(t.body);
  const [values, setValues] = useState({});

  const handleSend = async () => {
    setSending(true);
    // Build components array for Meta API
    let template_components = [];
    if (vars.length > 0) {
      // Named params → use named format
      const isNamed = vars.some(v => isNaN(v)); // named if not purely numeric
      if (isNamed) {
        template_components = [{
          type: "body",
          parameters: vars.map(v => ({
            type: "text",
            parameter_name: v,
            text: values[v] || v,
          }))
        }];
      } else {
        // positional {{1}}, {{2}}
        template_components = [{
          type: "body",
          parameters: vars.map(v => ({
            type: "text",
            text: values[v] || v,
          }))
        }];
      }
    }
    await onSend(t, template_components);
    setSending(false);
  };

  const colors = categoryColor(t.category);

  return (
    <div className="px-5 py-4 transition-all hover:bg-white/5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {t.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <BarChart2 className={`w-3 h-3 ${colors}`} />
          <span className={`text-[11px] font-semibold ${colors}`}>{t.category || 'UTILITY'}</span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>| {(t.language || 'en').toUpperCase()}</span>
        </div>
      </div>

      {/* Body preview — toggle */}
      {t.body && (
        <button
          onClick={() => setExpanded(x => !x)}
          className="w-full text-left mb-2 flex items-start gap-1 group"
        >
          <p className={`text-xs whitespace-pre-wrap leading-relaxed flex-1 ${expanded ? '' : 'line-clamp-2'}`} style={{ color: 'rgba(255,255,255,0.5)' }}>
            {renderBody(t.body)}
          </p>
          {expanded ? <ChevronUp className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />}
        </button>
      )}

      {/* Variable inputs — show if template has variables */}
      {vars.length > 0 && (
        <div className="mb-3 space-y-2">
          {vars.map(v => (
            <div key={v} className="flex items-center gap-2">
              <span className="text-[11px] font-medium shrink-0 w-28 truncate" style={{ color: 'hsl(38 92% 55%)' }}>
                {`{{${v}}}`}
              </span>
              <Input
                value={values[v] || ''}
                onChange={e => setValues(prev => ({ ...prev, [v]: e.target.value }))}
                placeholder={`Enter ${v}…`}
                className="h-7 text-xs flex-1"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.9)'
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={sending}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
        style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}
      >
        {sending
          ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending…</>
          : <><Send className="w-3 h-3" /> Send Template</>
        }
      </button>
    </div>
  );
}

export default function TemplatesModal({ open, onClose, templates, onSelect }) {
  const [search, setSearch] = useState("");

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.body || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async (t, template_components) => {
    await onSelect(t, template_components);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg w-full p-0 overflow-hidden gap-0"
        style={{ background: 'hsl(222 47% 10%)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            WhatsApp Templates
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="pl-9 text-sm h-9"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto" style={{ maxHeight: '480px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No templates found
            </div>
          ) : (
            filtered.map(t => (
              <TemplateRow key={t.name + t.language} t={t} onSend={handleSend} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm transition"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}