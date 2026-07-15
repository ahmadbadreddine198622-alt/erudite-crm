import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ExternalLink, Globe, BarChart3, Building2, FileText, Link2, ChevronDown, ChevronUp, Brain } from 'lucide-react';

// ── PROJECT INTELLIGENCE SOURCES ─────────────────────────────────────────────
// Clickable card of curated live sources (ProjectIntelSource entity) for this
// landlord's project: portal insights pages, official brand sites, live feeds.
// The same records are auto-injected into the landlord brain + call-script forge,
// so what the agent sees here is exactly what the AI is armed with.
const TYPE_META = {
  portal_insights: { label: 'Portal Insights', Icon: BarChart3, color: '#60a5fa' },
  brand_official: { label: 'Official Brand', Icon: Building2, color: 'hsl(38 92% 55%)' },
  portal_transactions: { label: 'Live Transactions', Icon: FileText, color: '#34d399' },
  portal_listings: { label: 'Live Listings', Icon: Globe, color: '#a78bfa' },
  dld_report: { label: 'DLD Report', Icon: FileText, color: '#f87171' },
  other: { label: 'Source', Icon: Link2, color: 'rgba(255,255,255,0.6)' },
};

const projNorm = (s) => String(s || '').toLowerCase()
  .replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5')
  .replace(/[\s\-_\.]+/g, '');

export default function ProjectIntelSources({ projectName }) {
  const [expanded, setExpanded] = useState(null);

  const { data: sources = [] } = useQuery({
    queryKey: ['project-intel-sources', projectName],
    queryFn: async () => {
      if (!projectName) return [];
      const rows = await base44.entities.ProjectIntelSource.filter({ show_in_ui: true }).catch(() => []);
      const a = projNorm(projectName);
      return (Array.isArray(rows) ? rows : [])
        .filter((s) => { const b = projNorm(s.project_name); return a && b && (a === b || a.includes(b) || b.includes(a)); })
        .sort((x, y) => (x.sort_order ?? 99) - (y.sort_order ?? 99));
    },
    enabled: !!projectName,
    staleTime: 5 * 60 * 1000,
  });

  if (!projectName || !sources.length) return null;

  return (
    <div className="px-6 py-4" style={{
      background: 'linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0.03) 100%)',
      borderBottom: '2px solid rgba(212,175,55,0.30)',
      borderTop: '1px solid rgba(212,175,55,0.12)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'hsl(38 92% 55%)' }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'hsl(38 92% 55%)', letterSpacing: '0.1em' }}>
            Intelligence Sources
          </span>
        </div>
        <div className="flex items-center gap-1.5" title="These sources are injected live into the AI brain and call scripts">
          <Brain className="w-3.5 h-3.5" style={{ color: 'rgba(212,175,55,0.55)' }} />
          <span className="text-[10px]" style={{ color: 'rgba(212,175,55,0.55)' }}>feeding the brain</span>
        </div>
      </div>

      {/* Source rows */}
      <div className="space-y-2">
        {sources.map((s) => {
          const meta = TYPE_META[s.source_type] || TYPE_META.other;
          const Icon = meta.Icon;
          const isOpen = expanded === s.id;
          const facts = Array.isArray(s.key_facts) ? s.key_facts : [];
          return (
            <div key={s.id} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.18)' }}>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{s.source_name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {meta.label}{s.last_checked ? ` · checked ${s.last_checked}` : ''}
                  </p>
                </div>
                {facts.length > 0 && (
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
                    title={isOpen ? 'Hide key facts' : 'Show key facts'}
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: 'rgba(212,175,55,0.7)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(212,175,55,0.7)' }} />}
                  </button>
                )}
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(212,175,55,0.15)', color: 'hsl(38 92% 55%)', border: '1px solid rgba(212,175,55,0.35)' }}
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {isOpen && facts.length > 0 && (
                <div className="px-3 pb-2.5 pt-0.5 space-y-1">
                  {facts.map((f, i) => (
                    <p key={i} className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      <span style={{ color: 'hsl(38 92% 55%)' }}>›</span> {f}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
