// SimilarUnitTab — shows similar units currently FOR SALE on Property Finder
// (and Bayut) in the same project as the landlord's unit. Runs an AI web search
// on demand and renders each listing as a card with price, beds, area, agent and
// a deep link.
//
// Rendered as the "Similar Unit" tab inside LandlordMockTabs.

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Search, Building2, BedDouble, Maximize, Bath, ExternalLink, ImageOff, Tag } from 'lucide-react';
import { toast } from 'sonner';

const GOLD = '#C9A24B';

function card() {
  return {
    borderRadius: 13,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  };
}
function fmtAED(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return 'AED ' + Number(n).toLocaleString('en-US');
}

function ListingCard({ l }) {
  const [imgError, setImgError] = useState(false);
  const portal = l.portal || 'Property Finder';
  const portalColor = /property finder/i.test(portal) ? '#00D09C' : '#E74C3C';
  return (
    <div style={{ ...card(), display: 'flex', flexDirection: 'column' }}>
      {/* Image / placeholder */}
      <div style={{ height: 130, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {l.image_url && !imgError ? (
          <img src={l.image_url} alt={l.title || ''} onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageOff size={26} color="rgba(255,255,255,0.2)" />
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', background: portalColor + '22', color: portalColor, border: '1px solid ' + portalColor + '55' }}>
          {portal}
        </span>
        {l.listed_days_ago != null && (
          <span style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 99, fontSize: 9, fontWeight: 600, background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.8)' }}>
            {l.listed_days_ago}d ago
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3, minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {l.title || 'Unit for sale'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={12} color={GOLD} />
          <span style={{ fontSize: 14.5, fontWeight: 800, color: GOLD }}>{fmtAED(l.price_aed)}</span>
          {l.area_sqft ? <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>· {Number(l.area_sqft).toLocaleString()} sqft</span> : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          {l.bedrooms != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><BedDouble size={12} /> {l.bedrooms === 0 ? 'Studio' : l.bedrooms + ' BR'}</span>}
          {l.bathrooms != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Bath size={12} /> {l.bathrooms}</span>}
          {l.floor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Building2 size={12} /> Fl {l.floor}</span>}
        </div>

        {l.agent_name && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>Listed by {l.agent_name}</div>}

        {l.source_url && (
          <a href={l.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: portalColor, textDecoration: 'none', marginTop: 2 }}>
            View listing <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function SimilarUnitTab({ landlordId, landlord }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const project = landlord?.project_name || '';
  const layout = landlord?.unit_layout || '';
  const asking = landlord?.asking_price_aed;

  const runSearch = async () => {
    if (loading) return;
    if (!project) {
      toast.error('No project set on this landlord — set a project name first');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('findSimilarUnitsForSale', { landlord_id: landlordId });
      const data = res?.data ?? res;
      if (data?.error) {
        toast.error(data.error);
      } else {
        setResult(data);
        const n = (data?.listings || []).length;
        toast.success(n === 0 ? 'No similar units found for sale right now' : `Found ${n} similar unit${n === 1 ? '' : 's'} for sale`);
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to search Property Finder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header context */}
      <div style={{ ...card(), padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,162,75,0.16)', color: GOLD }}>
            <Building2 size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Same project</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{project || 'No project set'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{layout || '—'}{asking ? ' · asking ' + fmtAED(asking) : ''}</div>
          </div>
        </div>
        <button
          onClick={runSearch}
          disabled={loading || !project}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: "'Inter',sans-serif",
            background: 'linear-gradient(180deg, rgba(0,208,156,0.22), rgba(0,208,156,0.1))',
            color: '#34d399', border: '1px solid rgba(0,208,156,0.4)', opacity: (loading || !project) ? 0.6 : 1,
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Searching Property Finder…' : 'Find similar units for sale'}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 0', color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
          <Loader2 size={15} className="animate-spin" /> Searching Property Finder &amp; Bayut for active listings…
        </div>
      )}

      {!loading && result && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Search size={13} color="#00D09C" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
              Similar units for sale ({(result.listings || []).length})
            </span>
          </div>
          {result.research_note && (
            <div style={{ ...card(), padding: '10px 13px', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.5 }}>
              {result.research_note}
            </div>
          )}
          {(result.listings || []).length === 0 ? (
            <div style={{ ...card(), padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
              No similar units currently for sale in {project}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {result.listings.map((l, i) => <ListingCard key={i} l={l} />)}
            </div>
          )}
        </div>
      )}

      {!loading && !result && (
        <div style={{ ...card(), padding: '28px 18px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
          Click “Find similar units for sale” to search Property Finder for active listings in {project || 'this project'}.
        </div>
      )}
    </div>
  );
}