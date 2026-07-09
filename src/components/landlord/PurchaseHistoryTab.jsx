// PurchaseHistoryTab — shows everything we know about a landlord's property
// ownership: linked properties from the CRM database (LandlordProperty + Property)
// plus an AI web-search enrichment that scrapes Property Finder / DLD / public
// records for additional purchase history.
//
// Rendered as a new tab ("Purchase History") inside LandlordMockTabs, right
// after the Activity tab.

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Globe, RefreshCw, Building2, MapPin, Home, Calendar, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const GOLD = '#C9A24B';

function card() {
  return {
    borderRadius: 13,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.025)',
    padding: '14px 16px',
  };
}
function label(s) {
  return { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' };
}
function val(s) {
  return { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)', marginTop: 2 };
}
function fmtAED(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return 'AED ' + Number(n).toLocaleString('en-US');
}
function fmtYear(d) {
  if (!d) return '—';
  const y = new Date(d).getFullYear();
  return isNaN(y) ? String(d) : String(y);
}

function StatPill({ icon, label, value, color }) {
  return (
    <div style={{ ...card(), flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '22', color }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={label()}>{label}</div>
        <div style={{ ...val(), fontSize: 17 }}>{value}</div>
      </div>
    </div>
  );
}

function PropertyCard({ lp, prop }) {
  const tenancy = lp.tenancy_status || (lp.currently_occupied === false ? 'vacant' : lp.currently_occupied === true ? 'owner_occupied' : 'unknown');
  const vacant = tenancy === 'vacant' || lp.currently_occupied === false;
  const valueAed = lp.ai_estimated_value_aed || prop?.price_aed || null;

  return (
    <div style={{ ...card(), display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,162,75,0.16)', color: GOLD }}>
            <Building2 size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {prop?.building_name || prop?.title || lp.listing_title || 'Unnamed unit'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {prop?.location || prop?.address || lp.pf_location_name || '—'}
            </div>
          </div>
        </div>
        {/* Vacant / occupied badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99,
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          background: vacant ? 'rgba(34,197,94,0.14)' : (tenancy === 'unknown' ? 'rgba(148,163,184,0.12)' : 'rgba(96,165,250,0.14)'),
          color: vacant ? '#4ade80' : (tenancy === 'unknown' ? 'rgba(255,255,255,0.55)' : '#60a5fa'),
          border: '1px solid ' + (vacant ? 'rgba(34,197,94,0.3)' : (tenancy === 'unknown' ? 'rgba(148,163,184,0.25)' : 'rgba(96,165,250,0.3)')),
        }}>
          {vacant ? 'Vacant' : tenancy === 'unknown' ? 'Occupancy ?' : 'Occupied'}
        </span>
      </div>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
        {[
          { l: 'Project', v: prop?.location || lp.pf_location_name || '—' },
          { l: 'Unit no', v: prop?.unit_no || '—' },
          { l: 'Floor', v: lp.title_deed_number ? '' : '', raw: null },
          { l: 'Handover', v: fmtYear(prop?.completion_date) },
          { l: 'Type', v: prop?.property_type || (lp.is_off_plan ? 'off-plan' : 'ready') },
          { l: 'Beds', v: prop?.bedrooms != null ? String(prop.bedrooms) : '—' },
        ].map((r, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '7px 9px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={label()}>{r.l}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.82)', marginTop: 1 }}>{r.v}</div>
          </div>
        ))}
      </div>

      {/* Value + tenancy footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div style={label()}>Estimated value</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{fmtAED(valueAed)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={label()}>Tenancy</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{String(tenancy).replace(/_/g, ' ')}</div>
        </div>
      </div>

      {lp.title_deed_number && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>
          <ShieldCheck size={12} /> Title deed: {lp.title_deed_number}
        </div>
      )}
    </div>
  );
}

function OnlinePropertyCard({ p }) {
  const vacant = p.vacant === true;
  const occ = p.vacant === null ? 'unknown' : (vacant ? 'vacant' : 'occupied');
  return (
    <div style={{ ...card(), display: 'flex', flexDirection: 'column', gap: 9, borderColor: 'rgba(96,165,250,0.22)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(96,165,250,0.16)', color: '#60a5fa' }}>
          <Globe size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{p.building_name || p.project_name || 'Discovered property'}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>{p.source_name || 'Web'}{p.confidence ? ` · ${p.confidence} confidence` : ''}</div>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          background: vacant ? 'rgba(34,197,94,0.14)' : occ === 'unknown' ? 'rgba(148,163,184,0.12)' : 'rgba(96,165,250,0.14)',
          color: vacant ? '#4ade80' : occ === 'unknown' ? 'rgba(255,255,255,0.55)' : '#60a5fa',
        }}>{occ}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {[
          ['Project', p.project_name],
          ['Unit no', p.unit_no],
          ['Floor', p.floor],
          ['Handover', p.handover_year],
          ['Off-plan', p.is_off_plan ? 'Yes' : 'No'],
          ['Est. value', fmtAED(p.estimated_value_aed)],
        ].map(([l, v], i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 7, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={label()}>{l}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>{v || '—'}</div>
          </div>
        ))}
      </div>
      {p.notes && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>{p.notes}</div>}
      {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: '#60a5fa', textDecoration: 'none' }}>View source ↗</a>}
    </div>
  );
}

export default function PurchaseHistoryTab({ landlordId, landlord }) {
  const qc = useQueryClient();
  const [gathering, setGathering] = useState(false);
  const [online, setOnline] = useState(null);

  // Fetch LandlordProperty links for this landlord.
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['landlord-properties', landlordId],
    enabled: !!landlordId,
    queryFn: () => base44.entities.LandlordProperty.filter({ landlord_id: landlordId }, '-created_date', 200),
  });

  // Fetch the linked Property records (deduped by id).
  const propertyIds = useMemo(() => [...new Set(links.map((l) => l.property_id).filter(Boolean))], [links]);
  const { data: properties = [] } = useQuery({
    queryKey: ['purchase-history-properties', propertyIds.join(',')],
    enabled: propertyIds.length > 0,
    queryFn: async () => {
      const out = [];
      for (const id of propertyIds) {
        try { out.push(await base44.entities.Property.get(id)); } catch (_) {}
      }
      return out;
    },
  });

  const propById = useMemo(() => {
    const m = {};
    properties.forEach((p) => { if (p && p.id) m[p.id] = p; });
    return m;
  }, [properties]);

  // Aggregate stats.
  const stats = useMemo(() => {
    let total = 0, vacantCount = 0, occupiedCount = 0;
    for (const lp of links) {
      const p = propById[lp.property_id];
      const v = lp.ai_estimated_value_aed || p?.price_aed;
      if (v && !isNaN(Number(v))) total += Number(v);
      if (lp.tenancy_status === 'vacant' || lp.currently_occupied === false) vacantCount++;
      else if (lp.tenancy_status && lp.tenancy_status !== 'vacant') occupiedCount++;
    }
    return { count: links.length, total, vacantCount, occupiedCount };
  }, [links, propById]);

  const ownerAddress = landlord?.mailing_address || [landlord?.address_city, landlord?.address_country].filter(Boolean).join(', ');

  const handleGather = async () => {
    if (gathering) return;
    setGathering(true);
    setOnline(null);
    try {
      const res = await base44.functions.invoke('gatherLandlordPortfolioOnline', { landlord_id: landlordId });
      const data = res?.data ?? res;
      if (data?.ok === false || data?.error) {
        toast.error(data?.error || 'Failed to gather data');
      } else {
        setOnline(data);
        toast.success(`Found ${(data?.properties || []).length} propert${(data?.properties || []).length === 1 ? 'y' : 'ies'} online`);
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to gather data online');
    } finally {
      setGathering(false);
    }
  };

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatPill icon={<Home size={18} />} label="Total apartments" value={stats.count} color={GOLD} />
        <StatPill icon={<Building2 size={18} />} label="Total value" value={fmtAED(stats.total)} color="#60a5fa" />
        <StatPill icon={<AlertTriangle size={18} />} label="Vacant" value={stats.vacantCount} color="#4ade80" />
        <StatPill icon={<ShieldCheck size={18} />} label="Occupied" value={stats.occupiedCount} color="#a78bfa" />
      </div>

      {/* Owner address + gather button */}
      <div style={{ ...card(), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <MapPin size={16} color="rgba(255,255,255,0.5)" />
          <div style={{ minWidth: 0 }}>
            <div style={label()}>Owner address</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>{ownerAddress || 'Not on file'}</div>
          </div>
        </div>
        <button
          onClick={handleGather}
          disabled={gathering}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: gathering ? 'wait' : 'pointer', fontFamily: "'Inter',sans-serif",
            background: 'linear-gradient(180deg, rgba(96,165,250,0.22), rgba(96,165,250,0.12))',
            color: '#93c5fd', border: '1px solid rgba(96,165,250,0.4)', opacity: gathering ? 0.7 : 1,
          }}
        >
          {gathering ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
          {gathering ? 'Searching web…' : 'Gather online (PF + DLD)'}
        </button>
      </div>

      {/* CRM-stored properties */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <Building2 size={13} color={GOLD} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
            Owned properties ({stats.count})
          </span>
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            <Loader2 size={14} className="animate-spin" /> Loading properties…
          </div>
        ) : links.length === 0 ? (
          <div style={{ ...card(), textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
            No linked properties in the CRM yet. Use “Gather online” to discover them.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {links.map((lp, i) => <PropertyCard key={lp.id || i} lp={lp} prop={propById[lp.property_id]} />)}
          </div>
        )}
      </div>

      {/* Online-gathered results */}
      {online && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Globe size={13} color="#60a5fa" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
              Online research ({(online.properties || []).length})
            </span>
          </div>
          {online.research_note && (
            <div style={{ ...card(), fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.5 }}>
              {online.research_note}
            </div>
          )}
          {(online.properties || []).length === 0 ? (
            <div style={{ ...card(), textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
              No additional properties found online.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {online.properties.map((p, i) => <OnlinePropertyCard key={i} p={p} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}