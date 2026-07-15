import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// MarketDistribution — read-only analytics block modeled on Property Finder's
// "Distribution by Beds". Reads MarketTransaction live, matches the landlord's
// project by case-insensitive prefix, filters to the last 12 months (excluding
// outliers), groups by bedroom config, and renders a donut + table + pricing
// position line. No writes to any entity.

const BED_ORDER = ['studio', '1br', '2br', '3br', '4plus'];
const BED_LABELS = { studio: 'Studio', '1br': '1 Bed', '2br': '2 Beds', '3br': '3 Beds', '4plus': '4+ Beds' };
const BED_COLORS = { studio: '#d4af37', '1br': '#eccd72', '2br': '#60a5fa', '3br': '#a78bfa', '4plus': '#34d399' };
const GOLD = '#d4af37';

// "Peninsula 5" matches "Peninsula 5", "Peninsula 5 - D1", "Peninsula 5-D2",
// "Peninsula 5 (Tower)" but NOT "Peninsula 53".
function matchProject(txProject, queryProject) {
  if (!txProject || !queryProject) return false;
  const tp = String(txProject).toLowerCase().trim();
  const qp = String(queryProject).toLowerCase().trim();
  if (tp === qp) return true;
  if (!tp.startsWith(qp)) return false;
  const next = tp[qp.length];
  return next === ' ' || next === '-' || next === '(';
}

function median(nums) {
  const s = nums.filter((n) => n != null && !isNaN(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function layoutToBed(layout) {
  if (!layout) return null;
  const s = String(layout).trim().toUpperCase();
  if (s === 'STUDIO' || s.includes('STUDIO')) return 'studio';
  if (s.includes('1BHK') || s.includes('1BR') || s.includes('1BED') || /^1/.test(s)) return '1br';
  if (s.includes('2BHK') || s.includes('2BR') || /^2/.test(s)) return '2br';
  if (s.includes('3BHK') || s.includes('3BR') || /^3/.test(s)) return '3br';
  if (s.includes('PENTHOUSE') || /^[4-9]/.test(s)) return '4plus';
  return null;
}

function fmtAed(n) {
  if (n == null) return '—';
  if (n >= 1e6) return `AED ${(n / 1e6).toFixed(2)}M`;
  return `AED ${Math.round(n).toLocaleString()}`;
}

function fmtDate(d) {
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MarketDistribution({ projectName, unitLayout, askingPriceAed }) {
  // Global fetch — cached 10 min so navigating between landlords reuses one load.
  const { data: allTx = [], isLoading } = useQuery({
    queryKey: ['market-transactions-all'],
    queryFn: () => base44.entities.MarketTransaction.list('-transaction_date', 5000),
    staleTime: 10 * 60 * 1000,
  });

  const { groups, total, dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    const matched = (allTx || []).filter(
      (t) =>
        matchProject(t.project_name, projectName) &&
        !t.is_outlier &&
        t.transaction_date &&
        new Date(t.transaction_date) >= cutoff
    );

    const byBed = {};
    for (const b of BED_ORDER) byBed[b] = [];
    for (const t of matched) {
      if (!BED_ORDER.includes(t.bedrooms)) continue;
      byBed[t.bedrooms].push(t);
    }

    const grp = BED_ORDER.map((b) => {
      const items = byBed[b];
      const prices = items.map((t) => t.price_aed).filter((v) => v != null);
      const sqfts = items.map((t) => t.area_sqft).filter((v) => v != null);
      const pps = items.map((t) => t.price_per_sqft).filter((v) => v != null);
      return {
        bed: b,
        label: BED_LABELS[b],
        color: BED_COLORS[b],
        count: items.length,
        minSqft: sqfts.length ? Math.min(...sqfts) : null,
        maxSqft: sqfts.length ? Math.max(...sqfts) : null,
        medianPrice: median(prices),
        medianPsqft: median(pps),
      };
    });

    const dates = matched
      .map((t) => new Date(t.transaction_date).getTime())
      .filter((v) => !isNaN(v));
    return {
      groups: grp,
      total: matched.length,
      dateFrom: dates.length ? new Date(Math.min(...dates)) : cutoff,
      dateTo: dates.length ? new Date(Math.max(...dates)) : now,
    };
  }, [allTx, projectName]);

  const landlordBed = layoutToBed(unitLayout);
  const lowData = total > 0 && total < 5;

  // Pricing position vs the landlord's own bed-type median
  let pricingLine = null;
  if (askingPriceAed && landlordBed) {
    const g = groups.find((x) => x.bed === landlordBed);
    if (g && g.medianPrice) {
      const pct = ((askingPriceAed - g.medianPrice) / g.medianPrice) * 100;
      const color = pct > 10 ? '#fbbf24' : Math.abs(pct) <= 10 ? '#34d399' : '#60a5fa';
      pricingLine = { pct, color, asking: askingPriceAed, median: g.medianPrice };
    }
  }

  // Donut geometry
  const donutGroups = groups.filter((g) => g.count > 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  let accLen = 0;
  const segments = donutGroups.map((g) => {
    const frac = total > 0 ? g.count / total : 0;
    const len = frac * C;
    const seg = { ...g, len, dashoffset: -accLen };
    accLen += len;
    return seg;
  });

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{
        background: 'linear-gradient(135deg, rgba(13,19,34,0.96) 0%, rgba(9,14,26,0.96) 100%)',
        border: '1px solid rgba(212,175,55,0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-wrap gap-1">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
            <span className="text-xs font-bold uppercase" style={{ color: GOLD, letterSpacing: '0.1em' }}>
              Market Distribution
            </span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {fmtDate(dateFrom)} to {fmtDate(dateTo)} · {total} transaction{total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Loading market data…
        </div>
      ) : total === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Limited market data for this project — no matching transactions in the last 12 months.
          </p>
        </div>
      ) : (
        <>
          {lowData && (
            <div
              className="mb-3 rounded-lg px-3 py-2 text-[10px]"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}
            >
              Limited market data for this project — {total} transaction{total === 1 ? '' : 's'} only.
            </div>
          )}

          {/* Donut + legend */}
          <div className="flex items-center gap-5 mb-4 flex-wrap">
            <svg viewBox="0 0 100 100" style={{ width: 124, height: 124, flex: 'none' }}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
              {segments.map((s) => (
                <circle
                  key={s.bed}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${s.len} ${C - s.len}`}
                  strokeDashoffset={s.dashoffset}
                  transform="rotate(-90 50 50)"
                />
              ))}
              <text x="50" y="49" textAnchor="middle" style={{ fill: 'rgba(255,255,255,0.95)', fontSize: 19, fontWeight: 700 }}>
                {total}
              </text>
              <text x="50" y="61" textAnchor="middle" style={{ fill: 'rgba(255,255,255,0.45)', fontSize: 6, letterSpacing: '0.12em' }}>
                SALES
              </text>
            </svg>
            <div className="flex flex-col gap-1.5">
              {donutGroups.map((g) => (
                <div key={g.bed} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: g.color }} />
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {g.label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>
                    {g.count}
                  </span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    ({total > 0 ? Math.round((g.count / total) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {['Bed', 'Txns', 'Size (sqft)', 'Median Price', 'AED/sqft'].map((h, i) => (
                    <th
                      key={h}
                      className="py-1.5 px-2"
                      style={{
                        textAlign: i === 0 ? 'left' : 'right',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: 9,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const isLandlord = g.bed === landlordBed;
                  return (
                    <tr
                      key={g.bed}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: isLandlord ? 'rgba(212,175,55,0.12)' : 'transparent',
                        boxShadow: isLandlord ? 'inset 2px 0 0 #d4af37' : 'none',
                      }}
                    >
                      <td className="py-1.5 px-2" style={{ color: isLandlord ? GOLD : 'rgba(255,255,255,0.85)', fontWeight: isLandlord ? 700 : 500 }}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm" style={{ background: g.color }} />
                          {g.label}
                          {isLandlord && (
                            <span className="text-[8px] font-bold" style={{ color: GOLD }}>
                              YOUR UNIT
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {g.count || '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {g.minSqft != null ? `${Math.round(g.minSqft)}–${Math.round(g.maxSqft)}` : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                        {g.medianPrice != null ? fmtAed(g.medianPrice) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {g.medianPsqft != null ? Math.round(g.medianPsqft).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pricing position */}
          {pricingLine && (
            <div
              className="mt-3 rounded-lg px-3 py-2 text-[11px] font-medium"
              style={{ background: pricingLine.color + '1a', border: `1px solid ${pricingLine.color}55`, color: pricingLine.color }}
            >
              Asking {fmtAed(pricingLine.asking)} vs market median {fmtAed(pricingLine.median)} — {Math.abs(pricingLine.pct).toFixed(0)}%{' '}
              {pricingLine.pct >= 0 ? 'above' : 'below'} median
            </div>
          )}
        </>
      )}
    </div>
  );
}