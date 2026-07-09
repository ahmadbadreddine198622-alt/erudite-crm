// OwnerHistoryTab — shows the landlord's real owner portfolio pulled live from
// the shared Google Drive portfolio spreadsheets (Peninsula 1/2/3/5).
//
// Data source: fetchOwnerPortfolio backend function, which reads the two Excel
// files in the Drive folder and matches the landlord by name / email / phone.
// Displays: total units owned, total apartments, projects, areas, and each
// unit's number, building/project name and area.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, MapPin, Home, Hash, Loader2, User, RefreshCw, Layers, AlertCircle } from 'lucide-react';

const GOLD = '#C9A24B';

function card() {
  return {
    borderRadius: 13,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.025)',
  };
}

function StatTile({ icon, label, value, accent }) {
  return (
    <div style={{ ...card(), padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (accent || GOLD) + '22', color: accent || GOLD }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</div>
      </div>
    </div>
  );
}

function UnitRow({ u, index }) {
  return (
    <div style={{ ...card(), padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GOLD + '22', color: GOLD, fontSize: 11, fontWeight: 800, flex: 'none' }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={13} color={GOLD} /> {u.property_name || 'Unknown project'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <MapPin size={10} /> {u.area || '—'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', flex: 'none' }}>
        <Hash size={12} /> {u.unit_code || '—'}
      </div>
    </div>
  );
}

export default function OwnerHistoryTab({ landlordId, landlord }) {
  const ownerName = landlord?.full_name_en || landlord?.full_name || '';
  const ownerEmail = landlord?.email || '';
  const ownerPhone = landlord?.phone || landlord?.whatsapp || '';

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['ownerPortfolio', ownerName, ownerEmail, ownerPhone],
    queryFn: async () => {
      const res = await base44.functions.invoke('fetchOwnerPortfolio', {
        owner_name: ownerName,
        owner_email: ownerEmail,
        owner_phone: ownerPhone,
      });
      return res?.data ?? res;
    },
    enabled: !!ownerName || !!ownerEmail || !!ownerPhone,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const matched = data?.matched === true;
  const units = data?.units || [];
  const totalUnits = data?.total_units || 0;
  const projects = data?.projects || [];
  const areas = data?.areas || [];

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Refresh / status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', cursor: isLoading || isFetching ? 'wait' : 'pointer', background: 'transparent', border: 'none', fontFamily: 'inherit', opacity: isLoading || isFetching ? 0.5 : 1 }}
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh from Drive
        </button>
      </div>

      {isLoading && (
        <div style={{ ...card(), padding: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.5)' }}>
          <Loader2 size={22} className="animate-spin" style={{ color: GOLD }} />
          <div style={{ fontSize: 12.5 }}>Reading portfolio spreadsheets from Google Drive…</div>
        </div>
      )}

      {!isLoading && error && (
        <div style={{ ...card(), padding: '20px', display: 'flex', alignItems: 'center', gap: 10, color: '#fca5a5', fontSize: 12.5 }}>
          <AlertCircle size={16} /> Failed to load portfolio: {error.message || 'unknown error'}
        </div>
      )}

      {!isLoading && !error && !matched && (
        <div style={{ ...card(), padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12.5 }}>
          <AlertCircle size={18} style={{ margin: '0 auto 8px', display: 'block', color: 'rgba(255,255,255,0.3)' }} />
          No owner record found in the portfolio spreadsheets matching this landlord.
          {data?.totalUnits > 0 && (
            <div style={{ fontSize: 11, marginTop: 6, color: 'rgba(255,255,255,0.3)' }}>
              Searched {data.totalUnits.toLocaleString()} units synced from Drive.
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && matched && (
        <>
          {/* Owner summary header */}
          <div style={{ ...card(), padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GOLD + '22', color: GOLD }}>
              <User size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Owner</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{data.owner_name || ownerName || '—'}</div>
              {data.owner_email && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{data.owner_email}</div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            <StatTile icon={<Home size={16} />} label="Total units owned" value={totalUnits} accent="#34d399" />
            <StatTile icon={<Layers size={16} />} label="Total apartments" value={totalUnits} accent="#60a5fa" />
            <StatTile icon={<Building2 size={16} />} label="Projects" value={projects.length} accent="#a78bfa" />
            <StatTile icon={<MapPin size={16} />} label="Areas" value={areas.length} accent={GOLD} />
          </div>

          {/* Units list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Building2 size={13} color={GOLD} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                Apartments ({units.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {units.map((u, i) => <UnitRow key={i} u={u} index={i} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}