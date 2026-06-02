import React, { useState } from 'react';
import { ExternalLink, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Phone, MessageCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

const CONFIDENCE_STYLES = {
  High:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  Medium:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  Partial: { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30',   dot: 'bg-slate-400' },
};

const PORTAL_LOGOS = {
  'Property Finder': (
    <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
      <rect width="40" height="40" rx="8" fill="#00D09C" fillOpacity="0.15"/>
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#00D09C">PF</text>
    </svg>
  ),
  'Bayut': (
    <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
      <rect width="40" height="40" rx="8" fill="#E74C3C" fillOpacity="0.15"/>
      <text x="20" y="26" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#E74C3C">BY</text>
    </svg>
  ),
};

function PortalCard({ portal, brief_summary, onDraftWhatsApp }) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_STYLES[portal.confidence.label] || CONFIDENCE_STYLES.Partial;

  const copyUrl = () => {
    navigator.clipboard.writeText(portal.url);
    toast.success('Link copied');
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          {PORTAL_LOGOS[portal.name] || null}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-white">{portal.name}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${conf.bg} ${conf.text} ${conf.border}`}>
                {portal.confidence.label} fit
              </span>
            </div>
            <p className="text-xs text-white/40 line-clamp-1">{brief_summary}</p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Filter coverage</span>
            <span className={`text-xs font-bold tabular-nums ${conf.text}`}>{portal.confidence.score}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(portal.confidence.score, 100)}%`, background: portal.confidence.label === 'High' ? '#10b981' : portal.confidence.label === 'Medium' ? '#f59e0b' : '#64748b' }}
            />
          </div>
        </div>

        {/* Filters applied */}
        <div className="space-y-1 mb-4">
          {portal.confidence.reasons.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-white/60">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              {r}
            </div>
          ))}
          {portal.confidence.gaps.map((g, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-amber-400/70">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {g}
            </div>
          ))}
        </div>

        {/* URL preview */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8 mb-4 cursor-pointer hover:bg-white/6 transition-all"
          onClick={copyUrl}
          title="Click to copy"
        >
          <span className="text-[10px] text-white/25 truncate flex-1 font-mono">{portal.url}</span>
          <Copy className="w-3 h-3 text-white/25 flex-shrink-0" />
        </div>

        {/* Primary CTA */}
        <a
          href={portal.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all border ${conf.bg} ${conf.text} ${conf.border} hover:opacity-90`}
        >
          <ExternalLink className="w-4 h-4" />
          Open {portal.name} Results
        </a>
      </div>

      {/* Quick actions */}
      <div className="border-t border-white/6 px-5 py-3 flex gap-2">
        <button
          onClick={() => onDraftWhatsApp(portal)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Draft WhatsApp
        </button>
        <button
          onClick={copyUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-semibold hover:text-white/70 transition-all"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy Link
        </button>
      </div>
    </div>
  );
}

export default function DeepLinkResults({ results, onDraftWhatsApp }) {
  const { source, portals = [], brief_summary, internal_count, searched_at, matches = [] } = results;
  const isLive = source === 'live_market';

  if (!isLive) {
    // Internal match results — simple summary
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border bg-emerald-500/10 border-emerald-500/25 text-emerald-300 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span><strong>{matches.length}</strong> internal matches found — no need to go to market</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((p, i) => (
            <div key={i} className="glass-card p-4">
              <p className="text-sm font-semibold text-white/90 mb-1">{p.title || p.location || 'Internal Property'}</p>
              <p className="text-amber-400 font-bold text-base">AED {Number(p.price_aed || p.rent_aed || 0).toLocaleString()}</p>
              <p className="text-xs text-white/40 mt-1">{p.location} · {p.bedrooms} BR · {p.property_type}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* No-match banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border bg-amber-500/8 border-amber-500/25 text-amber-300 text-sm">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <div>
          <span className="font-semibold">No internal match</span>
          <span className="text-white/50 ml-1">— opening the live market for:</span>
          <span className="ml-1 font-medium">{brief_summary}</span>
        </div>
        {searched_at && (
          <span className="ml-auto text-[10px] text-white/25 flex-shrink-0">
            {new Date(searched_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Compliance note */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-white/6 bg-white/3 mb-5">
        <AlertCircle className="w-3.5 h-3.5 text-white/25 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-white/30 leading-relaxed">
          These are pre-filtered search links — they open live, current portal results directly. No listing data is stored or scraped. Always call the client first per Erudite protocol before sharing links.
        </p>
      </div>

      {/* Portal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {portals.map(portal => (
          <PortalCard
            key={portal.name}
            portal={portal}
            brief_summary={brief_summary}
            onDraftWhatsApp={onDraftWhatsApp}
          />
        ))}
      </div>

      {internal_count > 0 && (
        <p className="text-xs text-white/25 text-center mt-4">
          {internal_count} internal {internal_count === 1 ? 'property' : 'properties'} found but below match threshold
        </p>
      )}
    </div>
  );
}