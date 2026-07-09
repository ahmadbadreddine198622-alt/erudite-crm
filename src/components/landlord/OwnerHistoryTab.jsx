// OwnerHistoryTab — shows the landlord's owner profile: mailing address, total
// units owned, and each unit's project/building/floor/unit-number.
//
// Data source: currently derived from the Landlord record's own fields. The
// richer multi-unit dataset (full portfolio) will be wired once the user
// specifies where to pull it from.

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, MapPin, Home, Layers, Hash, Loader2, User, RefreshCw } from 'lucide-react';

const GOLD = '#C9A24B';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

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
    <div style={{ ...card(), padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GOLD + '22', color: GOLD, fontSize: 11, fontWeight: 800, flex: 'none' }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={13} color={GOLD} /> {u.project || u.building || 'Unknown project'}
        </div>
        {u.address && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <MapPin size={10} /> {u.address}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {u.floor != null && u.floor !== '' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            <Layers size={11} /> Floor {u.floor}
          </div>
        )}
        {u.unit_number && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            <Hash size={11} /> {u.unit_number}
          </div>
        )}
        {u.layout && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            <Home size={11} /> {u.layout}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerHistoryTab({ landlordId, landlord }) {
  // Placeholder dataset derived from the landlord's own record. The user will
  // specify the real source (e.g. DLD lookup / external API) — the units array
  // is the single seam to replace.
  const units = useMemo(() => {
    if (!landlord) return [];
    const u = {
      project: landlord.project_name || '',
      building: landlord.project_name || '',
      address: landlord.mailing_address || '',
      floor: '',
      unit_number: landlord.unit_reference || '',
      layout: landlord.unit_layout || '',
    };
    return u.project || u.unit_number ? [u] : [];
  }, [landlord]);

  const ownerName = landlord?.full_name_en || landlord?.full_name || '';
  const address = landlord?.mailing_address || landlord?.address_city || '';
  const totalUnits = units.length;

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Owner summary header */}
      <div style={{ ...card(), padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GOLD + '22', color: GOLD }}>
          <User size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Owner</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{ownerName || '—'}</div>
          {address && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <MapPin size={11} /> {address}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <StatTile icon={<Home size={16} />} label="Total units owned" value={totalUnits} accent="#34d399" />
        <StatTile icon={<Building2 size={16} />} label="Projects" value={new Set(units.map(u => u.project).filter(Boolean)).size} accent="#60a5fa" />
        <StatTile icon={<MapPin size={16} />} label="City" value={landlord?.address_city || landlord?.residence_country || '—'} accent={GOLD} />
      </div>

      {/* Units list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <Building2 size={13} color={GOLD} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
            Units ({units.length})
          </span>
        </div>
        {units.length === 0 ? (
          <div style={{ ...card(), padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
            No units recorded yet for this owner.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {units.map((u, i) => <UnitRow key={i} u={u} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}