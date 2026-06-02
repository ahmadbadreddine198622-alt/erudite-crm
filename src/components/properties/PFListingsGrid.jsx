import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  RefreshCw, Bed, Bath, Ruler, Filter, ExternalLink,
  FileDown, RotateCcw, Home, ChevronDown, ChevronUp, AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const GOLD = '#c9a85c';
const GREEN = '#3fcf8e';
const AUTO_SYNC_INTERVAL_MS = 60_000;

const formatPrice = (p) => {
  if (!p) return 'POA';
  if (p >= 1_000_000) return `AED ${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `AED ${(p / 1_000).toFixed(0)}K`;
  return `AED ${p.toLocaleString()}`;
};

const MAX_PRICE_OPTIONS = [
  { label: 'Any', value: null },
  { label: '≤500K', value: 500_000 },
  { label: '≤1.5M', value: 1_500_000 },
  { label: '≤3M', value: 3_000_000 },
  { label: '≤15M', value: 15_000_000 },
];

const BED_OPTIONS = [
  { label: 'Any', value: null },
  { label: 'Studio', value: 0 },
  { label: '1+', value: 1 },
  { label: '2+', value: 2 },
  { label: '3+', value: 3 },
  { label: '4+', value: 4 },
];

// Sort: sale first, then by created_date desc
function sortListings(arr) {
  return [...arr].sort((a, b) => {
    const purposeA = (a.listing_type || '').toLowerCase();
    const purposeB = (b.listing_type || '').toLowerCase();
    if (purposeA === 'sale' && purposeB !== 'sale') return -1;
    if (purposeA !== 'sale' && purposeB === 'sale') return 1;
    const dateA = new Date(a.created_date || 0).getTime();
    const dateB = new Date(b.created_date || 0).getTime();
    return dateB - dateA;
  });
}

function ChipGroup({ options, value, onChange, multi = false }) {
  const handleClick = (v) => {
    if (multi) {
      if (v === null) { onChange(null); return; }
      const current = value || [];
      if (current.includes(v)) onChange(current.filter(x => x !== v).length ? current.filter(x => x !== v) : null);
      else onChange([...current.filter(x => x !== null), v]);
    } else {
      onChange(v === value ? null : v);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isActive = multi
          ? (opt.value === null ? (!value || value.length === 0) : (value || []).includes(opt.value))
          : (value === opt.value || (opt.value === null && value === null));
        return (
          <button
            key={String(opt.value)}
            onClick={() => handleClick(opt.value)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: isActive ? GOLD : 'rgba(255,255,255,0.05)',
              color: isActive ? '#0a1320' : 'rgba(255,255,255,0.65)',
              border: `1px solid ${isActive ? GOLD : 'rgba(255,255,255,0.12)'}`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function generatePDF(listing) {
  const beds = listing.bedrooms === 0 ? 'Studio' : listing.bedrooms;
  const html = `
  <html><head><meta charset="utf-8"/>
  <style>
    body { font-family: Inter, sans-serif; background: #fff; color: #111; margin: 0; padding: 40px; }
    .header { background: #0a1320; color: #c9a85c; padding: 24px 32px; border-radius: 10px; margin-bottom: 28px; }
    .header h1 { font-size: 22px; margin: 0 0 4px; }
    .header .ref { font-size: 12px; opacity: 0.7; font-family: monospace; }
    .price { font-size: 28px; font-weight: 700; color: #c9a85c; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #e8e8e8; }
    td:first-child { color: #666; width: 40%; }
    td:last-child { font-weight: 600; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #888; line-height: 1.6; }
  </style></head>
  <body>
    <div class="header">
      <h1>${listing.title || `${listing.property_type} in ${listing.location}`}</h1>
      <div class="ref">REF: ${listing.reference_number || listing.pf_listing_id}</div>
    </div>
    <div class="price">${formatPrice(listing.price)}</div>
    <table>
      <tr><td>Location</td><td>${listing.location || '-'}, Dubai</td></tr>
      <tr><td>Type</td><td style="text-transform:capitalize">${listing.property_type || '-'}</td></tr>
      <tr><td>Bedrooms</td><td>${beds}</td></tr>
      <tr><td>Bathrooms</td><td>${listing.bathrooms || '-'}</td></tr>
      <tr><td>Size</td><td>${listing.area_sqft ? listing.area_sqft.toLocaleString() + ' sq ft' : '-'}</td></tr>
      <tr><td>Status</td><td>${listing.status === 'active' ? 'Live' : 'Inactive'}</td></tr>
    </table>
    <div class="footer">
      ERUDITE PROPERTY REAL ESTATE, Shop R-10, Marquise Square Tower, Marasi Drive, Business Bay, Dubai, UAE.<br/>
      T: +971 58 180 6000 | E: info@erudite-estate.com | W: www.eruditeproperty.com — TRN/VAT Reg No: 104029757200003
    </div>
  </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}

function ListingCard({ listing }) {
  const img = listing.images?.[0];
  const isLive = listing.status === 'active';
  const beds = listing.bedrooms === 0 ? 'Studio' : listing.bedrooms;
  const title = listing.title || `${listing.property_type} in ${listing.location}`;

  return (
    <div
      className="flex rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      style={{ background: '#0e1a2b', border: '1px solid #1a2942', minHeight: 132 }}
    >
      {/* Image */}
      <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 150 }}>
        {img ? (
          <img src={img} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: '#111e30' }}>
            <Home className="w-8 h-8 opacity-20 text-white" />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.35) 0%, transparent 60%)' }} />
        <div className="absolute top-2 left-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: isLive ? 'rgba(63,207,142,0.15)' : 'rgba(255,255,255,0.1)', color: isLive ? GREEN : 'rgba(255,255,255,0.5)', border: `1px solid ${isLive ? 'rgba(63,207,142,0.35)' : 'rgba(255,255,255,0.15)'}` }}>
            {isLive && <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />}
            {isLive ? 'Live' : 'Archived'}
          </span>
        </div>
        <div className="absolute bottom-2 left-2">
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)' }}>
            {listing.listing_type || '—'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 min-w-0 justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate mb-0.5" style={{ color: 'rgba(255,255,255,0.95)' }}>{title}</p>
          <p className="text-xs font-mono mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Ref: {listing.reference_number || listing.pf_listing_id}</p>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{beds}</span>
            <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{listing.bathrooms || '-'}</span>
            <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{listing.area_sqft ? listing.area_sqft.toLocaleString() : '-'} ft²</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold" style={{ color: GOLD }}>{formatPrice(listing.price)}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => generatePDF(listing)} title="Download PDF"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
              style={{ border: `1px solid ${GOLD}`, color: GOLD, background: 'transparent' }}>
              <FileDown className="w-3.5 h-3.5" />
            </button>
            {listing.pf_url && (
              <a href={listing.pf_url} target="_blank" rel="noopener noreferrer" title="Open in Property Finder"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PFListingsGrid() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState('live');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [fPurpose, setFPurpose] = useState(null);
  const [fTypes, setFTypes] = useState(null);
  const [fBeds, setFBeds] = useState(null);
  const [fArea, setFArea] = useState(null);
  const [fMaxPrice, setFMaxPrice] = useState(null);

  // Sync state
  const [syncState, setSyncState] = useState('idle'); // 'idle' | 'syncing' | 'done' | 'error'
  const [lastSynced, setLastSynced] = useState(null);
  const intervalRef = useRef(null);
  const isSyncingRef = useRef(false);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['pfListings'],
    queryFn: () => base44.entities.PFListing.filter({}, '-last_synced_at', 200),
    staleTime: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: () => base44.functions.invoke('syncPFListings', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pfListings'] });
      setLastSynced(new Date());
      setSyncState('done');
      setTimeout(() => setSyncState('idle'), 4000);
    },
    onError: () => {
      setSyncState('error');
    },
  });

  const runSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncState('syncing');
    try {
      await syncMutation.mutateAsync();
    } catch {
      // error handled in onError
    } finally {
      isSyncingRef.current = false;
    }
  }, [syncMutation]);

  // Auto-sync interval, paused when tab hidden
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') runSync();
      }, AUTO_SYNC_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        startInterval();
        runSync(); // immediate sync on tab focus
      } else {
        stopInterval();
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [runSync]);

  const allAreas = useMemo(() => [...new Set(listings.map(l => l.location).filter(Boolean))].sort(), [listings]);
  const allTypes = useMemo(() => [...new Set(listings.map(l => l.property_type).filter(Boolean))].sort(), [listings]);
  const typeOptions = [{ label: 'All', value: null }, ...allTypes.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))];
  const areaOptions = [{ label: 'All', value: null }, ...allAreas.map(a => ({ label: a, value: a }))];
  const activeFilterCount = [fPurpose, fTypes?.length ? fTypes : null, fBeds, fArea, fMaxPrice].filter(Boolean).length;
  const resetFilters = () => { setFPurpose(null); setFTypes(null); setFBeds(null); setFArea(null); setFMaxPrice(null); };

  const filtered = useMemo(() => {
    return sortListings(listings.filter(l => {
      if (statusTab === 'live' && l.status !== 'active') return false;
      if (statusTab === 'archived' && l.status !== 'inactive') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!((l.title || '').toLowerCase().includes(q) || (l.location || '').toLowerCase().includes(q) || (l.reference_number || '').toLowerCase().includes(q) || (l.pf_listing_id || '').toLowerCase().includes(q))) return false;
      }
      if (fPurpose && l.listing_type !== fPurpose) return false;
      if (fTypes?.length && !fTypes.includes(l.property_type)) return false;
      if (fBeds !== null) {
        if (fBeds === 0 && l.bedrooms !== 0) return false;
        if (fBeds > 0 && (l.bedrooms || 0) < fBeds) return false;
      }
      if (fArea && l.location !== fArea) return false;
      if (fMaxPrice && (l.price || 0) > fMaxPrice) return false;
      return true;
    }));
  }, [listings, statusTab, search, fPurpose, fTypes, fBeds, fArea, fMaxPrice]);

  // Fallback: 3 latest live listings if filtered < 3
  const latestFallback = useMemo(() => {
    if (filtered.length >= 3) return [];
    const liveSorted = sortListings(listings.filter(l => l.status === 'active'));
    const filteredIds = new Set(filtered.map(l => l.id));
    return liveSorted.filter(l => !filteredIds.has(l.id)).slice(0, 3 - filtered.length);
  }, [filtered, listings]);

  const syncLabel = syncState === 'syncing' ? 'Syncing…'
    : syncState === 'done' ? '✓ Synced'
    : syncState === 'error' ? 'Retry'
    : 'Sync';

  return (
    <div className="space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-xl p-1 gap-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {[['live', 'Live'], ['archived', 'Archived'], ['all', 'All']].map(([v, label]) => (
            <button key={v} onClick={() => setStatusTab(v)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: statusTab === v ? GOLD : 'transparent', color: statusTab === v ? '#0a1320' : 'rgba(255,255,255,0.55)' }}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Last synced */}
          {lastSynced && syncState === 'idle' && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Synced {formatDistanceToNow(lastSynced, { addSuffix: true })}
            </span>
          )}
          {syncState === 'error' && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: '#f87171' }}>
              <AlertCircle className="w-3 h-3" /> Sync failed — retrying
            </span>
          )}
          <button
            onClick={runSync}
            disabled={syncState === 'syncing'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
            style={{ background: syncState === 'done' ? 'rgba(63,207,142,0.12)' : syncState === 'error' ? 'rgba(248,113,113,0.12)' : 'rgba(201,168,92,0.12)', color: syncState === 'done' ? GREEN : syncState === 'error' ? '#f87171' : GOLD, border: `1px solid ${syncState === 'done' ? 'rgba(63,207,142,0.25)' : syncState === 'error' ? 'rgba(248,113,113,0.25)' : 'rgba(201,168,92,0.25)'}` }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            {syncLabel}
          </button>
        </div>
      </div>

      {/* Search + Filter toggle */}
      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search title, area, ref..."
          className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: '#0e1a2b', border: '1px solid #1a2942', color: 'rgba(255,255,255,0.85)', caretColor: GOLD }} />
        <button onClick={() => setFilterOpen(o => !o)}
          className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
          style={{ background: filterOpen ? 'rgba(201,168,92,0.15)' : '#0e1a2b', border: `1px solid ${filterOpen ? GOLD : '#1a2942'}`, color: filterOpen ? GOLD : 'rgba(255,255,255,0.65)' }}>
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ background: GOLD, color: '#0a1320' }}>{activeFilterCount}</span>
          )}
          {filterOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="rounded-2xl p-4 space-y-4" style={{ background: '#0e1a2b', border: '1px solid #1a2942' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>PURPOSE</p>
              <ChipGroup options={[{ label: 'All', value: null }, { label: 'Sale', value: 'sale' }, { label: 'Rent', value: 'rent' }]} value={fPurpose} onChange={setFPurpose} />
            </div>
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>BEDROOMS (MIN)</p>
              <ChipGroup options={BED_OPTIONS} value={fBeds} onChange={setFBeds} />
            </div>
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>TYPE</p>
              <ChipGroup options={typeOptions} value={fTypes} onChange={setFTypes} multi />
            </div>
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>MAX PRICE</p>
              <ChipGroup options={MAX_PRICE_OPTIONS} value={fMaxPrice} onChange={setFMaxPrice} />
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>AREA</p>
              <ChipGroup options={areaOptions} value={fArea} onChange={setFArea} />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <RotateCcw className="w-3 h-3" /> Reset filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {filtered.length} {statusTab === 'live' ? 'live' : statusTab === 'archived' ? 'archived' : 'total'} {filtered.length === 1 ? 'listing' : 'listings'}
      </p>

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: '#0e1a2b' }} />)}
        </div>
      ) : (
        <>
          {filtered.length === 0 && latestFallback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed" style={{ borderColor: '#1a2942', background: 'rgba(14,26,43,0.5)' }}>
              <Home className="w-10 h-10 mb-3 opacity-20 text-white" />
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>No listings match.</p>
              <button onClick={() => { setStatusTab('live'); resetFilters(); setSearch(''); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(201,168,92,0.12)', color: GOLD, border: `1px solid rgba(201,168,92,0.3)` }}>
                Back to Live
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(l => <ListingCard key={l.id} listing={l} />)}

              {/* Fallback section */}
              {latestFallback.length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Latest listings</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  </div>
                  {latestFallback.map(l => <ListingCard key={l.id} listing={l} />)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}