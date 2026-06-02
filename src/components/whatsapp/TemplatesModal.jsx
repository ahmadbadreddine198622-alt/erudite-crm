import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, BarChart2 } from "lucide-react";

export default function TemplatesModal({ open, onClose, templates, onSelect, isSending }) {
  const [search, setSearch] = useState("");

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.body?.toLowerCase().includes(search.toLowerCase())
  );

  const categoryColor = (cat) => {
    if (!cat) return "text-gray-400";
    if (cat === "MARKETING") return "text-pink-400";
    if (cat === "UTILITY") return "text-blue-400";
    if (cat === "AUTHENTICATION") return "text-amber-400";
    return "text-gray-400";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden" style={{ background: 'hsl(222 47% 11%)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            WhatsApp Templates
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="pl-9 text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
        </div>

        {/* Template list */}
        <div className="overflow-y-auto max-h-[420px] divide-y" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', divideColor: 'rgba(255,255,255,0.07)' }}>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No templates found
            </div>
          ) : (
            filtered.map(t => (
              <button
                key={t.name + t.language}
                onClick={() => { onSelect(t); onClose(); }}
                disabled={isSending}
                className="w-full text-left px-5 py-4 transition-all hover:bg-white/5 disabled:opacity-50"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{t.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <BarChart2 className={`w-3.5 h-3.5 ${categoryColor(t.category)}`} />
                    <span className={`text-[11px] font-semibold ${categoryColor(t.category)}`}>{t.category || 'UTILITY'}</span>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>| {(t.language || 'en').toUpperCase()}</span>
                  </div>
                </div>

                {/* Body preview */}
                {t.body && (
                  <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {t.body}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm transition"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}