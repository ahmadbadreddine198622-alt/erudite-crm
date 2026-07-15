import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import LandlordCard from './LandlordCard';
import { PHASES, STAGE_ORDER } from '@/lib/landlordStageGuide';

// Short human-readable labels for the stage rail pills
const STAGE_SHORT = {
  initial_contact:       'Initial',
  attempted_to_contact:  'Attempted',
  price_discovery:       'Price',
  listing_commitment:    'Commitment',
  form_a_initiation:     'Form A',
  form_a_signing:        'Sign ✦',
  owner_documents:       'Docs',
  photos_videos:         'Media',
  photographer_scheduling: 'Shoot',
  listing_creation:      'Create',
  internal_verification: 'QC',
  listing_publication:   'Publish',
  final_confirmation:    'Confirm',
  marketing_agents:      'Agents',
  marketing_network:     'Network',
  open_house:            'Open House',
  client_blast:          'Blast',
  deal_closed:           'Closed ✓',
};

export default function KanbanBoard({
  stages,
  stageLabels,
  stageGroups,
  selectedLandlordId,
  onSelectLandlord,
  onStageChange,
  selectedIds = new Set(),
  onToggleSelect,
  users = [],
  onSingleAssign,
  photographyTasks = [],
  getPhotoForPhone,
  onDragActiveChange,
}) {
  const [activeId, setActiveId] = useState(null);
  const [activeStage, setActiveStage] = useState(stages[0]);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [boardHovered, setBoardHovered] = useState(false);

  // ── Smart navigation state ──
  // Auto-slim: empty stages render as 46px droppable rails unless the user opts out
  // (persisted) or manually expands one for this session.
  const [showEmpty, setShowEmpty] = useState(() => {
    try { return localStorage.getItem('erudite_pipeline_show_empty') === '1'; } catch { return false; }
  });
  const [expandedEmpties, setExpandedEmpties] = useState(() => new Set());
  const [pulseStage, setPulseStage] = useState(null); // brief gold glow after a rail-pill jump

  // Ref mirror of activeStage so the scroll handler can compare without needing it
  // in the useCallback dependency (which would recreate the handler on every stage change).
  // Without this, scrollIntoView + setActiveStage fire on EVERY scroll pixel, piling up
  // smooth-scroll animations and forcing 17× layout reflows per frame → board hangs.
  const activeStageRef = useRef(stages[0]);

  const scrollRef = useRef(null);           // board scroll container
  const railRef = useRef(null);             // stage rail scroll container
  const columnRefs = useRef({});            // stage key → column DOM node

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
      // Only activate drag on primary mouse button (left click), never on right/middle
      onActivation: ({ event }) => {
        if (event.button !== undefined && event.button !== 0) return false;
      },
    }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // Map landlord id -> its current stage
  const idToStage = useMemo(() => {
    const map = new Map();
    stages.forEach((stage) => {
      (stageGroups[stage] || []).forEach((l) => map.set(l.id, stage));
    });
    return map;
  }, [stages, stageGroups]);

  // Per-stage live counts → rail badges + slim-empty decisions
  const stageCounts = useMemo(() => {
    const m = {};
    stages.forEach((s) => { m[s] = (stageGroups[s] || []).length; });
    return m;
  }, [stages, stageGroups]);

  const emptyCount = useMemo(
    () => stages.reduce((n, s) => n + ((stageCounts[s] || 0) === 0 ? 1 : 0), 0),
    [stages, stageCounts],
  );

  // Total pipeline value across the whole board — drives each column's value-share bar.
  const boardTotalCommission = useMemo(
    () => stages.reduce(
      (sum, s) => sum + (stageGroups[s] || []).reduce((a, l) => a + (l.estimated_commission_aed || 0), 0),
      0,
    ),
    [stages, stageGroups],
  );

  // Total landlord count across the board — shown on the phase band's right side.
  const boardLandlordCount = useMemo(
    () => stages.reduce((n, s) => n + (stageGroups[s]?.length || 0), 0),
    [stages, stageGroups],
  );

  const isCollapsed = useCallback(
    (s) => !showEmpty && (stageCounts[s] || 0) === 0 && !expandedEmpties.has(s),
    [showEmpty, stageCounts, expandedEmpties],
  );

  const expandStage = useCallback((s) => {
    setExpandedEmpties((prev) => { const n = new Set(prev); n.add(s); return n; });
  }, []);

  const toggleShowEmpty = useCallback(() => {
    setShowEmpty((v) => {
      const nv = !v;
      try { localStorage.setItem('erudite_pipeline_show_empty', nv ? '1' : '0'); } catch { /* ignore */ }
      return nv;
    });
    setExpandedEmpties(new Set()); // re-slim manual expansions when toggling back
  }, []);

  const activeLandlord = useMemo(() => {
    if (!activeId) return null;
    for (const stage of stages) {
      const found = (stageGroups[stage] || []).find((l) => l.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, stages, stageGroups]);

  const resolveDestStage = (overId) => {
    if (!overId) return null;
    if (stages.includes(overId)) return overId;
    return idToStage.get(overId) || null;
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    onDragActiveChange?.(false);
    if (!over) return;
    const sourceStage = idToStage.get(active.id);
    const destStage = resolveDestStage(over.id);
    if (!destStage || !sourceStage) return;
    if (sourceStage === destStage) return;
    onStageChange({ id: active.id, newStage: destStage });
  };

  // ── Scroll helpers ──────────────────────────────────────────────────────────

  // Scroll the board so `stageKey`'s column is at the left edge
  const scrollToStage = useCallback((stageKey) => {
    const board = scrollRef.current;
    const col = columnRefs.current[stageKey];
    if (!board || !col) return;
    const colLeft = col.offsetLeft - board.offsetLeft;
    board.scrollTo({ left: colLeft, behavior: 'smooth' });
    // Keep ref in sync so the scroll handler doesn't re-fire scrollIntoView for the same stage
    activeStageRef.current = stageKey;
    setActiveStage(stageKey);
    // Pulse the target column so the eye lands instantly after the jump
    setPulseStage(stageKey);
    window.setTimeout(() => setPulseStage((p) => (p === stageKey ? null : p)), 1500);
  }, []);

  // Update active-stage pill and arrow visibility on scroll
  const onBoardScroll = useCallback(() => {
    const board = scrollRef.current;
    if (!board) return;

    const sl = board.scrollLeft;
    setShowLeft(sl > 4);
    setShowRight(sl < board.scrollWidth - board.clientWidth - 4);

    // Find the column closest to the left edge
    let best = stages[0];
    let bestDist = Infinity;
    for (const s of stages) {
      const col = columnRefs.current[s];
      if (!col) continue;
      const dist = Math.abs(col.offsetLeft - board.offsetLeft - sl);
      if (dist < bestDist) { bestDist = dist; best = s; }
    }

    // Only update state + sync the rail when the active stage ACTUALLY changes.
    // Without this guard, setActiveStage + scrollIntoView({behavior:'smooth'}) fire
    // on every scroll pixel (~60fps) — the smooth-scroll animations pile up and
    // the 17× offsetLeft reads above force a layout reflow each frame, freezing the
    // board during drag (when dnd-kit autoScroll is scrolling).
    if (best !== activeStageRef.current) {
      activeStageRef.current = best;
      setActiveStage(best);
      const rail = railRef.current;
      if (rail) {
        const pill = rail.querySelector(`[data-stage="${best}"]`);
        if (pill) pill.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [stages]);

  useEffect(() => {
    const board = scrollRef.current;
    if (!board) return;
    board.addEventListener('scroll', onBoardScroll, { passive: true });
    onBoardScroll(); // init
    return () => board.removeEventListener('scroll', onBoardScroll);
  }, [onBoardScroll]);

  // Native wheel listener with passive:false so preventDefault() actually works.
  // React's onWheel is passive by default → preventDefault() is a no-op, and the
  // browser's native scroll fights with the manual scrollLeft assignment.
  useEffect(() => {
    const board = scrollRef.current;
    if (!board) return;

    const handleWheel = (e) => {
      // Horizontal trackpad swipe → let the browser handle natively
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // Vertical wheel — check if cursor is over a scrollable column
      const colEl = e.target.closest('[data-column-scroll]');
      if (colEl) {
        const atTop = colEl.scrollTop <= 0;
        const atBottom = colEl.scrollTop + colEl.clientHeight >= colEl.scrollHeight - 1;
        const scrollingUp = e.deltaY < 0;
        const scrollingDown = e.deltaY > 0;
        // If the column can still scroll in this direction, let it scroll vertically
        if ((scrollingUp && !atTop) || (scrollingDown && !atBottom)) return;
      }

      // Column is at its boundary, or cursor is over board background → horizontal scroll
      e.preventDefault();
      board.scrollLeft += e.deltaY;
    };

    board.addEventListener('wheel', handleWheel, { passive: false });
    return () => board.removeEventListener('wheel', handleWheel);
  }, []);

  // Edge-arrow: advance one column in given direction
  const stepColumn = useCallback((dir) => {
    const board = scrollRef.current;
    if (!board) return;
    const sl = board.scrollLeft;
    // Step between MEANINGFUL columns — skip slim empty rails (they're all visible anyway)
    const pool = stages.filter((s) => !isCollapsed(s));
    const sorted = (pool.length > 1 ? pool : stages)
      .map(s => ({ s, left: (columnRefs.current[s]?.offsetLeft ?? 0) - board.offsetLeft }))
      .sort((a, b) => a.left - b.left);

    if (dir === 1) {
      const next = sorted.find(({ left }) => left > sl + 8);
      if (next) board.scrollTo({ left: next.left, behavior: 'smooth' });
    } else {
      const prev = [...sorted].reverse().find(({ left }) => left < sl - 8);
      if (prev) board.scrollTo({ left: prev.left, behavior: 'smooth' });
    }
  }, [stages, isCollapsed]);

  // ← / → keyboard stepping (ignored while typing or inside menus/dialogs)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      if (t?.closest?.('[role="menu"],[role="listbox"],[role="dialog"],[data-radix-popper-content-wrapper]')) return;
      e.preventDefault();
      stepColumn(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepColumn]);

  // Build ordered flat list of stages matching what phases expose
  const orderedStages = useMemo(() => {
    const set = new Set(stages);
    return STAGE_ORDER.filter(s => set.has(s));
  }, [stages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>

      {/* ── Stage Rail (minimap) ─────────────────────────────────────────── */}
      <div
        ref={railRef}
        className="shrink-0 flex items-center gap-1 overflow-x-auto pb-1 mb-2 px-1"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`.rail-hide::-webkit-scrollbar{display:none}`}</style>
        {PHASES.map((phase) => {
          const phaseStages = phase.stages.filter(s => stages.includes(s));
          if (phaseStages.length === 0) return null;
          return (
            <div key={phase.key} className="flex items-center gap-1 shrink-0">
              {/* Phase separator label — slate, phase color reduced to a 6px dot with a still soft halo */}
              <span
                className="shrink-0 flex items-center gap-1 whitespace-nowrap"
                style={{ fontFamily: "'Montserrat',sans-serif", fontSize: '10px', fontWeight: 600, padding: '0 4px', color: '#A7B0C4', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: phase.color, flex: 'none', boxShadow: `0 0 7px ${phase.color}CC` }} />
                {phase.name.split(' ')[0]}
              </span>
              {phaseStages.map((s) => {
                const isActive = s === activeStage;
                const zero = (stageCounts[s] || 0) === 0;
                return (
                  <button
                    key={s}
                    data-stage={s}
                    onClick={() => scrollToStage(s)}
                    className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                    style={{
                      fontFamily: "'Montserrat',sans-serif",
                      background: 'transparent',
                      border: isActive ? '1px solid rgba(198,161,91,0.4)' : '1px solid rgba(255,255,255,0.10)',
                      color: isActive ? '#C6A15B' : '#A7B0C4',
                      boxShadow: 'none',
                      opacity: zero && !isActive ? 0.35 : 1,
                      transition: 'border-color 150ms ease, color 150ms ease, opacity 150ms ease',
                    }}
                    title={stageLabels[s] || s}
                  >
                    {STAGE_SHORT[s] || stageLabels[s] || s}
                    <span
                      style={{
                        marginLeft: 5,
                        fontSize: '9px',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: isActive ? '#C6A15B' : '#E9EDF6',
                      }}
                    >
                      {stageCounts[s] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Slim-empties toggle — empty stages render as 46px droppable rails by default */}
        {emptyCount > 0 && (
          <button
            onClick={toggleShowEmpty}
            className="shrink-0 ml-auto flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-200"
            style={{
              fontFamily: "'Montserrat',sans-serif",
              background: 'transparent',
              border: showEmpty ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(198,161,91,0.4)',
              color: showEmpty ? 'rgba(255,255,255,0.7)' : '#C6A15B',
            }}
            title={showEmpty
              ? `Slim the ${emptyCount} empty stage${emptyCount === 1 ? '' : 's'} down to compact rails`
              : `${emptyCount} empty stage${emptyCount === 1 ? '' : 's'} slimmed — click to show at full width`}
          >
            {showEmpty ? <Minimize2 className="w-3 h-3" strokeWidth={1.5} /> : <Maximize2 className="w-3 h-3" strokeWidth={1.5} />}
            {showEmpty ? 'Slim empty' : `${emptyCount} slim`}
          </button>
        )}
      </div>

      {/* ── Board scroll container with edge arrows ─────────────────────── */}
      <div
        style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0 }}
        onMouseEnter={() => setBoardHovered(true)}
        onMouseLeave={() => setBoardHovered(false)}
      >
        {/* Left edge arrow */}
        <button
          onClick={() => stepColumn(-1)}
          disabled={!showLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-12 rounded-r-xl transition-all duration-200"
          style={{
            background: 'linear-gradient(90deg, rgba(7,10,18,0.9), transparent)',
            opacity: showLeft ? 1 : 0,
            pointerEvents: showLeft ? 'auto' : 'none',
            color: '#D8B26A',
            border: 'none',
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right edge arrow */}
        <button
          onClick={() => stepColumn(1)}
          disabled={!showRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-12 rounded-l-xl transition-all duration-200"
          style={{
            background: 'linear-gradient(270deg, rgba(7,10,18,0.9), transparent)',
            opacity: showRight ? 1 : 0,
            pointerEvents: showRight ? 'auto' : 'none',
            color: '#D8B26A',
            border: 'none',
          }}
        >
          <ChevronRight className="w-5 h-5"
            style={{ color: true ? '#D8B26A' : undefined }}
          />
        </button>

        {/* Scrollable board — native overflow for both axes.
            onWheel only routes vertical→horizontal when NOT over a column,
            so columns keep their own vertical scroll. */}
        <div
        ref={scrollRef}
        className="board-scroll overflow-x-auto overflow-y-hidden pb-2"
        style={{
          height: '100%',
          position: 'relative',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(216,178,106,.35) transparent',
          borderRight: '1px solid rgba(255,255,255,.06)',
          borderLeft: '1px solid rgba(255,255,255,.06)',

          overscrollBehavior: 'contain',
          touchAction: 'pan-x',
        }}
        >
          <style>{`
            .board-scroll::-webkit-scrollbar { height: 10px; }
            .board-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 99px; margin: 0 4px; }
            .board-scroll::-webkit-scrollbar-thumb { background: rgba(216,178,106,.4); border-radius: 99px; border: 2px solid transparent; background-clip: padding-box; }
            .board-scroll::-webkit-scrollbar-thumb:hover { background: rgba(216,178,106,.65); background-clip: padding-box; }
            @keyframes eruditePulse { 0% { box-shadow: 0 0 0 0 rgba(216,178,106,.55); } 100% { box-shadow: 0 0 0 16px rgba(216,178,106,0); } }
          `}</style>

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={(e) => { setActiveId(e.active.id); onDragActiveChange?.(true); }}
            onDragCancel={() => { setActiveId(null); onDragActiveChange?.(false); }}
            onDragEnd={handleDragEnd}
            autoScroll={{ threshold: { x: 0.15, y: 0.2 } }}
          >
            <div className="board-inner flex flex-row items-stretch gap-5 pb-4 px-3 h-full" style={{ minWidth: 'max-content' }}>
              {PHASES.map((phase) => {
                const phaseStages = phase.stages.filter((s) => stages.includes(s));
                if (phaseStages.length === 0) return null;
                const phaseCount = phaseStages.reduce((n, s) => n + (stageGroups[s]?.length || 0), 0);
                return (
                  <div key={phase.key} className="flex flex-col gap-2 shrink-0 h-full">
                    {/* Phase band — hairline #0E1428, 7px dot (gold+halo for the active phase, slate otherwise) + name + ghost count chip + board total on the right. */}
                    <div
                      className="rounded-xl px-4 py-2 flex items-center gap-2.5 shrink-0"
                      style={{
                        background: '#0E1428',
                        border: '1px solid rgba(255,255,255,0.07)',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 999, flex: 'none', background: phaseStages.includes(activeStage) ? '#D8B26A' : '#A7B0C4', boxShadow: phaseStages.includes(activeStage) ? '0 0 7px rgba(216,178,106,0.8)' : 'none' }} />
                      <span className="whitespace-nowrap" style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 600, fontSize: 12, color: '#E9EDF6', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {phase.name}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A7B0C4', fontVariantNumeric: 'tabular-nums' }}>
                        {phaseCount}
                      </span>
                      <span className="ml-auto text-[10.5px] shrink-0" style={{ color: '#A7B0C4', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
                        PIPELINE AED {(boardTotalCommission / 1000000).toFixed(1)}M · {boardLandlordCount} LANDLORDS
                      </span>
                    </div>

                    {/* Stage columns */}
                    <div className="flex flex-row items-stretch gap-4 flex-1 min-h-0">
                      {phaseStages.map((stage) => (
                        <div
                          key={stage}
                          ref={(el) => { if (el) columnRefs.current[stage] = el; }}
                          style={{ height: '100%', ...(pulseStage === stage ? { animation: 'eruditePulse 1.1s ease-out 2', borderRadius: 18 } : {}) }}
                        >
                          <KanbanColumn
                            stage={stage}
                            collapsed={isCollapsed(stage)}
                            onExpand={expandStage}
                            label={stageLabels[stage]}
                            landlords={stageGroups[stage] || []}
                            selectedLandlordId={selectedLandlordId}
                            selectedIds={selectedIds}
                            onSelectLandlord={onSelectLandlord}
                            onToggleSelect={onToggleSelect}
                            users={users}
                            onSingleAssign={onSingleAssign}
                            photographyTasks={photographyTasks}
                            getPhotoForPhone={getPhotoForPhone}
                            activeId={activeId}
                            onStageChange={onStageChange}
                            boardTotalCommission={boardTotalCommission}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <DragOverlay dropAnimation={{ duration: 180 }}>
              {activeLandlord ? (
                <div className="w-[300px] rounded-xl" style={{ transform: 'rotate(1.2deg)' }}>
                  <LandlordCard
                    landlord={activeLandlord}
                    isDragging
                    users={users}
                    photographyTasks={photographyTasks}
                    getPhotoForPhone={getPhotoForPhone}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
}