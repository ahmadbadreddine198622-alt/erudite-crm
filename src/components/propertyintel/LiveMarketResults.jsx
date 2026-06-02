import React, { useState } from 'react';
import { ExternalLink, Phone, MessageCircle, Bookmark, ChevronDown, ChevronUp, Building2, MapPin, BedDouble, Maximize2 } from 'lucide-react';

const SOURCE_STYLES = {
  'Property Finder': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Bayut': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Internal': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
};

function ScoreBar({ score }) {
  const pct = Math.min(score, 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#64748b';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct}</span>
    </div>
  );
}

function ListingCard({ listing, onWhatsApp, onSave }) {
  const src = SOURCE_STYLES[listing.source] || SOURCE_STYLES['Internal'];

  return (
    <div className="glass-card p-4 flex flex-col gap-3 hover:bg-white/8 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${src.bg} ${src.text} ${src.border}`}>
              {listing.source}
            </span>
            {listing.furnishing && (
              <span className="text-[10px] text-white/40 uppercase tracking-wider">{listing.furnishing}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white/90 leading-snug line-clamp-2">{listing.title}</p>
        </div>
        <a
          href={listing.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-amber-400 hover:border-amber-500/30 transition-all"
          title="Open listing"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Price */}
      <div className="text-lg font-bold text-amber-400 tabular-nums">
        AED {Number(listing.price).toLocaleString()}
        {listing.deal_type === 'lease' && <span className="text-xs text-white/40 font-normal ml-1">/yr</span>}
      </div>

      {/* Details */}
      <div className="flex flex-wrap gap-3 text-xs text-white/50">
        {listing.bedrooms !== undefined && (
          <span className="flex items-center gap-1">
            <BedDouble className="w-3 h-3" />
            {listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} BR`}
          </span>
        )}
        {listing.size_sqft > 0 && (
          <span className="flex items-center gap-1">
            <Maximize2 className="w-3 h-3" />
            {Number(listing.size_sqft).toLocaleString()} sqft
          </span>
        )}
        {listing.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {listing.location}
          </span>
        )}
        {listing.building && (
          <span className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {listing.building}
          </span>
        )}
      </div>

      {/* Match score */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Match Score</p>
        <ScoreBar score={listing.score} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-white/5">
        <a
          href={listing.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold text-center hover:bg-amber-500/25 transition-all"
        >
          View Listing
        </a>
        <button
          onClick={() => onWhatsApp && onWhatsApp(listing)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all"
          title="Draft WhatsApp"
        >
          <MessageCircle className="w-3 h-3" />
        </button>
        <button
          onClick={() => onSave && onSave(listing)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-semibold hover:text-white/70 transition-all"
          title="Save to shortlist"
        >
          <Bookmark className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function LiveMarketResults({ results, onWhatsApp, onSave }) {
  const [showAll, setShowAll] = useState(false);

  const { source, matches = [], pf_count = 0, bayut_count = 0, searched_at } = results;
  const isLive = source === 'live_market';
  const displayed = showAll ? matches : matches.slice(0, 6);

  return (
    <div>
      {/* Banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border text-sm font-medium ${
        isLive
          ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
          : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
      }`}>
        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
        {isLive ? (
          <span>
            No internal match — showing <strong>{matches.length}</strong> live market results
            {pf_count > 0 && ` · ${pf_count} from Property Finder`}
            {bayut_count > 0 && ` · ${bayut_count} from Bayut`}
          </span>
        ) : (
          <span><strong>{matches.length}</strong> internal matches found</span>
        )}
        {searched_at && (
          <span className="ml-auto text-[10px] text-white/30">
            {new Date(searched_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayed.map(listing => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onWhatsApp={onWhatsApp}
            onSave={onSave}
          />
        ))}
      </div>

      {/* Show more */}
      {matches.length > 6 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-4 w-full py-2.5 rounded-xl border border-white/10 text-white/40 text-xs font-semibold hover:text-white/70 hover:border-white/20 transition-all flex items-center justify-center gap-2"
        >
          {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show {matches.length - 6} more results</>}
        </button>
      )}

      {matches.length === 0 && (
        <div className="text-center py-12 text-white/30 text-sm">
          No listings found. Try broadening the budget or location.
        </div>
      )}
    </div>
  );
}