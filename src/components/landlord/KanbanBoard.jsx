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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import LandlordCard from './LandlordCard';
import { PHASES, STAGE_ORDER } from '@/lib/landlordStageGuide';

// Short human-readable labels for the stage rail pills
const STAGE_SHORT = {
  initial_contact:       'Initial',
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

  const scrollRef = useRef(null);           // board scroll container
  const railRef = useRef(null);             // stage rail scroll container
  const columnRefs = useRef({});            // stage key → column DOM node

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  // Map landlord id -> its current stage
  const idToStage = useMemo(() => {
    const map = new Map();
    stages.forEach((stage) => {
      (stageGroups[stage] || []).forEach((l) => map.set(l.id, stage));
    });
    return map;
  }, [stages, stageGroups]);

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
    setActiveStage(best);

    // Sync rail pill into view
    const rail = railRef.current;
    if (rail) {
      const pill = rail.querySelector(`[data-stage="${best}"]`);
      if (pill) pill.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
    }
  }, [stages]);

  useEffect(() => {
    const board = scrollRef.current;
    if (!board) return;
    board.addEventListener('scroll', onBoardScroll, { passive: true });
    onBoardScroll(); // init
    return () => board.removeEventListener('scroll', onBoardScroll);
  }, [onBoardScroll]);

  // Edge-arrow: advance one column in given direction
  const stepColumn = useCallback((dir) => {
    const board = scrollRef.current;
    if (!board) return;
    const sl = board.scrollLeft;
    const sorted = stages
      .map(s => ({ s, left: (columnRefs.current[s]?.offsetLeft ?? 0) - board.offsetLeft }))
      .sort((a, b) => a.left - b.left);

    if (dir === 1) {
      const next = sorted.find(({ left }) => left > sl + 8);
      if (next) board.scrollTo({ left: next.left, behavior: 'smooth' });
    } else {
      const prev = [...sorted].reverse().find(({ left }) => left < sl - 8);
      if (prev) board.scrollTo({ left: prev.left, behavior: 'smooth' });
    }
  }, [stages]);

  // Build ordered flat list of stages matching what phases expose
  const orderedStages = useMemo(() => {
    const set = new Set(stages);
    return STAGE_ORDER.filter(s => set.has(s));
  }, [stages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

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
              {/* Phase separator label */}
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-1 shrink-0 whitespace-nowrap"
                style={{ color: phase.color, opacity: 0.7 }}
              >
                {phase.name.split(' ')[0]}
              </span>
              {phaseStages.map((s) => {
                const isActive = s === activeStage;
                return (
                  <button
                    key={s}
                    data-stage={s}
                    onClick={() => scrollToStage(s)}
                    className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-200"
                    style={{
                      background: isActive
                        ? `${phase.color}22`
                        : 'rgba(255,255,255,0.04)',
                      border: isActive
                        ? `1px solid ${phase.color}`
                        : '1px solid rgba(255,255,255,0.1)',
                      color: isActive ? phase.color : 'rgba(255,255,255,0.55)',
                      boxShadow: isActive ? `0 0 8px ${phase.color}44` : 'none',
                    }}
                  >
                    {STAGE_SHORT[s] || stageLabels[s] || s}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Board scroll container with edge arrows ─────────────────────── */}
      <div
        style={{ position: 'relative', flex: 1, minHeight: 0 }}
        onMouseEnter={() => setBoardHovered(true)}
        onMouseLeave={() => setBoardHovered(false)}
      >
        {/* Left edge arrow */}
        <button
          onClick={() => stepColumn(-1)}
          disabled={!showLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-12 rounded-r-xl transition-all duration-200"
          style={{
            background: 'linear-gradient(90deg, rgba(15,20,25,0.85), transparent)',
            opacity: boardHovered && showLeft ? 1 : 0,
            pointerEvents: boardHovered && showLeft ? 'auto' : 'none',
            color: '#C9A24B',
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
            background: 'linear-gradient(270deg, rgba(15,20,25,0.85), transparent)',
            opacity: boardHovered && showRight ? 1 : 0,
            pointerEvents: boardHovered && showRight ? 'auto' : 'none',
            color: '#C9A24B',
            border: 'none',
          }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Scrollable board */}
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-hidden pb-2"
          style={{
            height: '100%',
            position: 'relative',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(38 92% 50% / 0.45) transparent',
            touchAction: 'pan-x pan-y',
          }}
          onWheel={(e) => {
            // Route vertical wheel events as horizontal scroll (trackpad/mouse wheel)
            if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          <style>{`
            .board-inner::-webkit-scrollbar { height: 8px; }
            .board-inner::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 99px; }
            .board-inner::-webkit-scrollbar-thumb { background: hsl(38 92% 50% / 0.4); border-radius: 99px; }
            .board-inner::-webkit-scrollbar-thumb:hover { background: hsl(38 92% 50% / 0.65); }
          `}</style>

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={(e) => { setActiveId(e.active.id); onDragActiveChange?.(true); }}
            onDragCancel={() => { setActiveId(null); onDragActiveChange?.(false); }}
            onDragEnd={handleDragEnd}
            autoScroll={{ threshold: { x: 0.15, y: 0.2 } }}
          >
            <div className="board-inner flex flex-row items-start gap-5 pb-4 px-3" style={{ minWidth: 'max-content' }}>
              {PHASES.map((phase) => {
                const phaseStages = phase.stages.filter((s) => stages.includes(s));
                if (phaseStages.length === 0) return null;
                const phaseCount = phaseStages.reduce((n, s) => n + (stageGroups[s]?.length || 0), 0);
                return (
                  <div key={phase.key} className="flex flex-col gap-2 shrink-0">
                    {/* Phase band */}
                    <div
                      className="rounded-xl px-3 py-2 flex items-center gap-2.5"
                      style={{
                        background: `linear-gradient(90deg, ${phase.color}26, ${phase.color}0d)`,
                        border: `1px solid ${phase.color}55`,
                        borderLeft: `3px solid ${phase.color}`,
                      }}
                    >
                      <span className="text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: phase.color, fontFamily: 'var(--font-display)' }}>
                        {phase.name}
                      </span>
                      <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {phase.purpose}
                      </span>
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${phase.color}22`, color: phase.color }}>
                        {phaseCount}
                      </span>
                    </div>

                    {/* Stage columns */}
                    <div className="flex flex-row items-start gap-4">
                      {phaseStages.map((stage) => (
                        <div
                          key={stage}
                          ref={(el) => { if (el) columnRefs.current[stage] = el; }}
                        >
                          <KanbanColumn
                            stage={stage}
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
                <div className="w-[300px] scale-[1.03] shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-xl">
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