import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Eye, MapPin, Layers, Ruler, CheckCircle2, ChevronDown, Maximize2, X, Compass, Building2 } from 'lucide-react';
import { toast } from 'sonner';

/* ── helpers ─────────────────────────────────────────────── */

const AREA_SOURCE_LABEL = {
  developer_plan: 'developer plan',
  dld_deed: 'DLD deed verified',
  estimated: 'estimated — confirm before quoting',
  pending: 'spec pending — do not quote',
};

const VIEW_OPTIONS = ['The Plaza', 'Community', 'Canal', 'Burj Khalifa', 'City/Skyline'];

const GOLD = 'hsl(38 92% 55%)';
const GOLD_DEEP = 'hsl(38 92% 45%)';

/* ── Verify-view popover ─────────────────────────────────── */

function VerifyViewControl({ landlord, onUpdate }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const mutation = useMutation({
    mutationFn: (view) =>
      base44.entities.Landlord.update(landlord.id, {
        unit_view: view,
        unit_view_source: 'agent_verified',
        unit_view_verified: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlords'] });
      qc.invalidateQueries({ queryKey: ['landlord', landlord.id] });
      setOpen(false);
      setCustom('');
      toast.success('View verified');
      onUpdate?.();
    },
    onError: (e) => toast.error('Save failed: ' + e.message),
  });

  const pick = (v) => mutation.mutate(v);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors"
          style={{ background: 'rgba(212,175,55,0.10)', color: GOLD, border: '1px solid rgba(212,175,55,0.30)' }}
        >
          <CheckCircle2 className="w-3 h-3" /> Verify view
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" side="bottom" align="start">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Verify the actual view
        </p>
        <div className="grid grid-cols-1 gap-1">
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => pick(v)}
              disabled={mutation.isPending}
              className="text-left text-xs px-2.5 py-1.5 rounded-md transition-colors hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)' }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Other…"
            className="flex-1 px-2 py-1 text-xs rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
          <button
            onClick={() => custom.trim() && pick(custom.trim())}
            disabled={mutation.isPending || !custom.trim()}
            className="text-xs px-2.5 py-1 rounded-md font-semibold disabled:opacity-50"
            style={{ background: GOLD, color: 'hsl(222 47% 11%)' }}
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Floor-plate SVG schematic ───────────────────────────── */

function FloorPlateSchematic({ floorPlate, highlightPos }) {
  const [selected, setSelected] = useState(null);
  if (!floorPlate?.sides) return null;

  const W = 440, H = 360;
  const x0 = 80, x1 = 360, y0 = 70, y1 = 290; // ring rect
  const ringW = x1 - x0, ringH = y1 - y0;

  const sides = floorPlate.sides || {};
  const positionTypes = floorPlate.position_types || {};
  const positionViews = floorPlate.position_views || {};

  // Build cell list per side with geometry
  const buildCells = (posArr, side) => {
    const arr = Array.isArray(posArr) ? posArr : [];
    const cells = [];
    if (side === 'top') {
      const cw = ringW / Math.max(arr.length, 1);
      arr.forEach((p, i) => cells.push({ pos: p, side, x: x0 + i * cw + 2, y: y0 - 30, w: cw - 4, h: 26 }));
    } else if (side === 'bottom') {
      const cw = ringW / Math.max(arr.length, 1);
      arr.forEach((p, i) => cells.push({ pos: p, side, x: x0 + i * cw + 2, y: y1 + 4, w: cw - 4, h: 26 }));
    } else if (side === 'left') {
      const ch = ringH / Math.max(arr.length, 1);
      arr.forEach((p, i) => cells.push({ pos: p, side, x: x0 - 32, y: y0 + i * ch + 2, w: 28, h: ch - 4 }));
    } else if (side === 'right') {
      const ch = ringH / Math.max(arr.length, 1);
      arr.forEach((p, i) => cells.push({ pos: p, side, x: x1 + 4, y: y0 + i * ch + 2, w: 28, h: ch - 4 }));
    }
    return cells;
  };

  const allCells = [
    ...buildCells(sides.top?.pos, 'top'),
    ...buildCells(sides.bottom?.pos, 'bottom'),
    ...buildCells(sides.left?.pos, 'left'),
    ...buildCells(sides.right?.pos, 'right'),
  ];

  const viewLabel = (side, x, y, anchor) => {
    const v = sides[side]?.view;
    if (!v) return null;
    return (
      <g key={'vl-' + side}>
        <text x={x} y={y} fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="600"
          textAnchor={anchor} style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          ◉ {v}
        </text>
      </g>
    );
  };

  const cellEl = (c) => {
    const isMine = String(c.pos) === String(highlightPos);
    const type = positionTypes[c.pos] || '';
    const fill = isMine ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.06)';
    const stroke = isMine ? 'hsl(38 92% 65%)' : 'rgba(255,255,255,0.18)';
    const txtColor = isMine ? 'hsl(222 47% 11%)' : 'rgba(255,255,255,0.7)';
    return (
      <g key={c.side + c.pos} style={{ cursor: 'pointer' }} onClick={() => setSelected({ pos: c.pos, type, view: positionViews[c.pos] || '' })}>
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={6} ry={6} fill={fill} stroke={stroke} strokeWidth={isMine ? 2 : 1} />
        {isMine && (
          <g transform={`translate(${c.x + c.w / 2 - 5}, ${c.y + c.h / 2 - 6})`}>
            <path d="M5 0 C2 0 0 2 0 5 C0 8 5 12 5 12 C5 12 10 8 10 5 C10 2 8 0 5 0 Z" fill="hsl(0 0% 100%)" />
            <circle cx="5" cy="5" r="2" fill={GOLD_DEEP} />
          </g>
        )}
        {c.w > 26 && (
          <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 3} fill={txtColor} fontSize="9" fontWeight="700" textAnchor="middle">
            {c.pos}
          </text>
        )}
        {c.w > 46 && type && (
          <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 14} fill={txtColor} fontSize="7.5" fontWeight="600" textAnchor="middle" opacity="0.8">
            {type}
          </text>
        )}
      </g>
    );
  };

  const sel = selected;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440, display: 'block', margin: '0 auto' }}>
        {/* ring outline */}
        <rect x={x0} y={y0} width={ringW} height={ringH} rx={10} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
        <text x={(x0 + x1) / 2} y={(y0 + y1) / 2 - 2} fill="rgba(255,255,255,0.12)" fontSize="11" fontWeight="700" textAnchor="middle" style={{ letterSpacing: '0.08em' }}>
          FLOOR PLATE
        </text>
        <text x={(x0 + x1) / 2} y={(y0 + y1) / 2 + 14} fill="rgba(255,255,255,0.20)" fontSize="8" textAnchor="middle">
          {floorPlate.band_label || ''}
        </text>

        {viewLabel('top', (x0 + x1) / 2, y0 - 38, 'middle')}
        {viewLabel('bottom', (x0 + x1) / 2, y1 + 50, 'middle')}
        {viewLabel('left', x0 - 38, (y0 + y1) / 2, 'middle')}
        {viewLabel('right', x1 + 38, (y0 + y1) / 2, 'middle')}

        {allCells.map(cellEl)}
      </svg>

      {/* tap tooltip */}
      {sel ? (
        <div className="mt-2 flex items-center gap-2 text-[10px] px-2.5 py-1.5 rounded-md"
          style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)' }}>
          <MapPin className="w-3 h-3" style={{ color: GOLD }} />
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>
            Position <b>{sel.pos}</b>{sel.type ? ` · ${sel.type}` : ''}{sel.view ? ` · ${sel.view}` : ''}
          </span>
          {String(sel.pos) === String(highlightPos) && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: GOLD, color: 'hsl(222 47% 11%)' }}>YOUR UNIT</span>
          )}
          <button className="ml-auto opacity-50 hover:opacity-100" onClick={() => setSelected(null)}><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <p className="mt-1.5 text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Tap any cell to see its type and view{highlightPos ? ' · gold = your unit' : ''}.
        </p>
      )}
    </div>
  );
}

/* ── main component ──────────────────────────────────────── */

export default function UnitIntelligence({ landlord, onUpdate, compact = false }) {
  const { data: unitPlan, isLoading: loadingPlan } = useQuery({
    queryKey: ['unit-plan', landlord?.unit_plan_id, landlord?.unit_plan_code],
    queryFn: async () => {
      if (landlord.unit_plan_id) {
        try { return await base44.entities.UnitPlan.get(landlord.unit_plan_id); } catch { /* fall through */ }
      }
      if (landlord?.unit_plan_code) {
        const rows = await base44.entities.UnitPlan.filter({ plan_code: landlord.unit_plan_code });
        return rows?.[0] || null;
      }
      return null;
    },
    enabled: !!landlord?.unit_plan_code,
  });

  const bandKey = unitPlan?.band_key;
  const { data: floorPlate } = useQuery({
    queryKey: ['floor-plate', landlord.project_id, bandKey],
    queryFn: async () => {
      const rows = await base44.entities.FloorPlate.filter({ project_id: landlord.project_id, band_key: bandKey });
      return rows?.[0] || null;
    },
    enabled: !!landlord.project_id && !!bandKey,
  });

  const [imgZoom, setImgZoom] = useState(false);
  const [imgError, setImgError] = useState(false);

  // plan_image_url (manual override) takes priority; otherwise fall back to the
  // developer floor-plan convention path /floorplans/{plan_code}.jpg.
  const resolvedPlanImg = !imgError
    ? (unitPlan.plan_image_url || (unitPlan.plan_code ? `/floorplans/${encodeURIComponent(unitPlan.plan_code)}.jpg` : ''))
    : '';

  // Render nothing unless the linking field is set
  if (!landlord?.unit_plan_code) return null;
  if (loadingPlan) {
    return (
      <div className="flex items-center gap-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <div className="w-3 h-3 border border-white/20 border-t-amber-400 rounded-full animate-spin" /> Loading unit plan…
      </div>
    );
  }
  if (!unitPlan) return null;

  /* ── COMPACT STRIP (under identity header) ── */
  if (compact) {
    const sizeBits = [];
    if (unitPlan.area_source !== 'pending' && unitPlan.total_sqft) {
      sizeBits.push(`${Math.round(unitPlan.total_sqft)} sqft`);
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ background: 'rgba(212,175,55,0.12)', color: GOLD, border: '1px solid rgba(212,175,55,0.30)' }}
        title={unitPlan.display_name}
      >
        <Building2 className="w-3 h-3" />
        {unitPlan.display_name || unitPlan.plan_code}
        {sizeBits.length > 0 && <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>· {sizeBits.join(' · ')}</span>}
        {landlord.unit_view && <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>· {landlord.unit_view}</span>}
      </span>
    );
  }

  /* ── FULL BLOCK (Unit tab, first section) ── */

  const areaSrc = unitPlan.area_source || 'pending';
  const showSize = areaSrc !== 'pending' && unitPlan.total_sqft != null;
  const showSplit = unitPlan.apartment_sqft != null && unitPlan.balcony_sqft != null;

  const brochureLevel = landlord.unit_floor != null && !unitPlan.podium ? landlord.unit_floor + 3 : null;
  const positionLine = [
    landlord.unit_reference ? `Unit ${landlord.unit_reference}` : null,
    landlord.unit_floor != null ? `floor ${landlord.unit_floor}` : null,
    brochureLevel != null ? `(brochure level ${brochureLevel})` : (unitPlan.podium && unitPlan.band_label ? `(brochure ${unitPlan.band_label})` : null),
    landlord.unit_position ? `stack ${landlord.unit_position}` : null,
  ].filter(Boolean).join(' — ');

  const stackingLine = unitPlan.stack_count_per_floor
    ? `${unitPlan.stack_count_per_floor} of this plan per floor${unitPlan.band_label ? ` on ${unitPlan.band_label}` : ''}`
    : null;

  const talkingPoints = Array.isArray(unitPlan.talking_points) ? unitPlan.talking_points : [];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.22)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
        style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.14), rgba(212,175,55,0.04))', borderBottom: '1px solid rgba(212,175,55,0.20)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <Building2 className="w-4 h-4" style={{ color: GOLD }} />
          <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{unitPlan.display_name || 'Unit Plan'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: GOLD, color: 'hsl(222 47% 11%)' }}>{unitPlan.plan_code}</span>
          {landlord.unit_layout && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>{landlord.unit_layout}</span>
          )}
        </div>
        {unitPlan.band_label && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Layers className="w-3 h-3" /> {unitPlan.band_label}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* SIZE */}
        {showSize ? (
          <div className="flex items-start gap-2">
            <Ruler className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
            <div className="flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-base font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>
                  {Math.round(unitPlan.total_sqft).toLocaleString()} sqft
                </span>
                {unitPlan.total_sqm != null && (
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{Math.round(unitPlan.total_sqm)} sqm</span>
                )}
              </div>
              {showSplit && (
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {Math.round(unitPlan.apartment_sqft).toLocaleString()} sqft internal + {Math.round(unitPlan.balcony_sqft).toLocaleString()} sqft balcony
                </p>
              )}
              <span className="inline-block mt-1 text-[9.5px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  background: areaSrc === 'dld_deed' ? 'rgba(16,185,129,0.12)' : areaSrc === 'estimated' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)',
                  color: areaSrc === 'dld_deed' ? '#34d399' : areaSrc === 'estimated' ? '#fbbf24' : 'rgba(255,255,255,0.55)',
                  border: '1px solid ' + (areaSrc === 'dld_deed' ? 'rgba(16,185,129,0.3)' : areaSrc === 'estimated' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.12)'),
                }}>
                {AREA_SOURCE_LABEL[areaSrc] || areaSrc}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <Ruler className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.28)' }}>
              spec pending — do not quote
            </span>
          </div>
        )}

        {/* VIEW */}
        <div className="flex items-start gap-2 flex-wrap">
          <Eye className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{landlord.unit_view || 'No view recorded'}</span>
            {landlord.unit_view_source === 'agent_verified' ? (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#34d399' }}>
                <CheckCircle2 className="w-3 h-3" /> Agent-verified
              </span>
            ) : landlord.unit_view_source === 'developer_plan' ? (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                per developer plan
              </span>
            ) : null}
          </div>
          <VerifyViewControl landlord={landlord} onUpdate={onUpdate} />
        </div>

        {/* POSITION */}
        {positionLine && (
          <div className="flex items-start gap-2">
            <Compass className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
            <div className="flex-1">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{positionLine}</p>
              {stackingLine && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{stackingLine}</p>}
            </div>
          </div>
        )}

        {/* TALKING POINTS */}
        {talkingPoints.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>Talking points</p>
            <div className="flex flex-wrap gap-1.5">
              {talkingPoints.map((tp, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-medium"
                  style={{ background: 'rgba(212,175,55,0.10)', color: GOLD, border: '1px solid rgba(212,175,55,0.28)' }}>
                  <span style={{ color: GOLD }}>•</span> {tp}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PLAN IMAGE (optional, above schematic) */}
        {resolvedPlanImg && (
          <div>
            <button onClick={() => setImgZoom(true)} className="block w-full rounded-lg overflow-hidden group relative" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
              <img
                src={resolvedPlanImg}
                alt="Developer floor plan"
                onError={() => setImgError(true)}
                className="w-full max-h-52 object-contain"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              />
              <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold"
                style={{ background: 'rgba(0,0,0,0.6)', color: GOLD }}>
                <Maximize2 className="w-3 h-3" /> Tap to zoom
              </span>
            </button>
          </div>
        )}

        {/* FLOOR PLATE SCHEMATIC */}
        {floorPlate ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
              Floor plate · {floorPlate.tower ? `Tower ${floorPlate.tower} · ` : ''}{floorPlate.band_label || floorPlate.band_key}
            </p>
            <FloorPlateSchematic floorPlate={floorPlate} highlightPos={landlord.unit_position} />
          </div>
        ) : bandKey ? (
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>No floor-plate schematic on file for this band.</p>
        ) : null}
      </div>

      {/* Lightbox */}
      {imgZoom && resolvedPlanImg && (
        <div onClick={() => setImgZoom(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setImgZoom(false)}><X className="w-6 h-6" /></button>
          <img src={resolvedPlanImg} alt="Developer floor plan" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}