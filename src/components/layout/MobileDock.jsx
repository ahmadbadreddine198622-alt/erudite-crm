/**
 * MobileDock — Slim floating nav bar with editable items.
 * Long-press 4s on any icon → edit mode (jiggle + add/remove/reorder).
 * Per-user config persisted to localStorage (keyed by user email).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Home, Plus, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_APPS, DEFAULT_NAV_LABELS, MIN_ITEMS, MAX_ITEMS } from '@/lib/navApps';
import AppPickerSheet from '@/components/ui/AppPickerSheet';

// ─── Constants ───────────────────────────────────────────────────────────────
const SZ = 44;          // icon squircle size
const R  = `${Math.round(SZ * 0.245)}px`;
const GLYPH = Math.round(SZ * 0.55);
const HOME_SZ = 58;
const HOME_R  = `${Math.round(HOME_SZ * 0.245)}px`;
const HOME_GLYPH = Math.round(HOME_SZ * 0.55);
const LONG_PRESS_MS = 4000;
const HOLD_CUE_MS   = 2000;


function storageKey(email) {
  return `nav_bar_items_${email || 'default'}`;
}

function loadSavedItems(email) {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return null;
    const labels = JSON.parse(raw);
    const resolved = labels
      .map(l => ALL_APPS.find(a => a.label === l))
      .filter(Boolean);
    if (resolved.length >= MIN_ITEMS) return resolved;
  } catch {}
  return null;
}

// ─── Squircle Icon ─────────────────────────────────────────────────────────
function NavIcon({ app, active, editMode, onRemove, holdCue }) {
  const { icon: Icon, gradient, label } = app;
  const [pressed, setPressed] = useState(false);

  const activeBg = 'linear-gradient(145deg, rgba(245,158,11,0.85) 0%, rgba(180,100,0,0.70) 100%)';
  const bg = active ? activeBg : gradient
    .replace('from-', '').split(' to-')
    .reduce((_, __, i, arr) => i === 0
      ? `linear-gradient(145deg, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 100%)`
      : _);

  // Build gradient from tailwind class strings
  const gradientStyle = (() => {
    const match = gradient.match(/from-(\S+)\s+to-(\S+)/);
    if (!match) return gradient;
    return gradient; // will use className bg-gradient-to-br
  })();

  const scale = active ? 1.05 : pressed ? 0.93 : 1;
  const glow = active ? '0 6px 18px rgba(245,158,11,0.50), 0 2px 8px rgba(0,0,0,0.40)' : '0 3px 12px rgba(0,0,0,0.45)';

  return (
    <div className="flex flex-col items-center gap-[3px] relative select-none" style={{ WebkitTapHighlightColor: 'transparent' }}>
      {/* Remove badge */}
      {editMode && (
        <button
          onPointerDown={e => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1.5 -left-1 z-20 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center border border-red-300/30 shadow-md"
          style={{ fontSize: 10 }}
        >
          <Minus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </button>
      )}

      <div
        style={{
          width: SZ, height: SZ, borderRadius: R, position: 'relative',
          transform: `scale(${holdCue ? 1.1 : scale})`,
          transition: 'transform 0.2s cubic-bezier(0.34,1.26,0.64,1)',
          boxShadow: glow,
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
      >
        {/* Gradient base */}
        <div className={`absolute inset-0 bg-gradient-to-br ${app.gradient.replace('from-', 'from-').replace(' to-', ' to-')}`}
          style={{ borderRadius: R, filter: active ? 'saturate(1.5) brightness(1.1)' : 'none' }} />
        {/* Glass overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: R,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: active ? '1.5px solid rgba(255,255,255,0.30)' : '1px solid rgba(255,255,255,0.15)',
          borderTopColor: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.30)',
        }} />
        {/* Top gloss */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: R,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0) 60%)',
          pointerEvents: 'none',
        }} />
        {/* Inner depth */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: R,
          boxShadow: 'inset 0 3px 8px rgba(255,255,255,0.08), inset 0 -4px 10px rgba(0,0,0,0.28)',
          pointerEvents: 'none',
        }} />
        {/* Active amber overlay */}
        {active && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: R,
            background: 'linear-gradient(145deg, rgba(245,158,11,0.60) 0%, rgba(160,90,0,0.50) 100%)',
          }} />
        )}
        <Icon style={{
          position: 'absolute', width: GLYPH, height: GLYPH,
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: 'rgba(255,255,255,0.95)',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.65))',
          strokeWidth: 2.2, zIndex: 2,
        }} />
        {/* Active contained glow */}
        {active && (
          <div style={{
            position: 'absolute', inset: -3, borderRadius: `calc(${R} + 3px)`,
            background: 'rgba(245,158,11,0.45)',
            filter: 'blur(8px)', opacity: 0.55,
            pointerEvents: 'none', zIndex: -1,
          }} />
        )}
        {/* Hold cue ring */}
        {holdCue && (
          <div style={{
            position: 'absolute', inset: -4, borderRadius: `calc(${R} + 4px)`,
            border: '2px solid rgba(245,158,11,0.6)',
            animation: 'pulse 1s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      <span style={{
        fontSize: 9, fontWeight: active ? 600 : 400,
        color: active ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.45)',
        letterSpacing: '0.02em',
      }}>{label}</span>
    </div>
  );
}



// ─── Main MobileDock ───────────────────────────────────────────────────────
export default function MobileDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  // Load user email for per-user storage
  const [userEmail, setUserEmail] = useState('');
  useEffect(() => {
    base44.auth.me().then(u => { if (u?.email) setUserEmail(u.email); }).catch(() => {});
  }, []);

  // Nav items state
  const [items, setItems] = useState(() => {
    const saved = loadSavedItems('');
    return saved || ALL_APPS.filter(a => DEFAULT_NAV_LABELS.includes(a.label)).slice(0, 4);
  });

  // Reload when we get user email
  useEffect(() => {
    if (!userEmail) return;
    const saved = loadSavedItems(userEmail);
    if (saved) setItems(saved);
  }, [userEmail]);

  const persistItems = useCallback((newItems, email) => {
    setItems(newItems);
    localStorage.setItem(storageKey(email || userEmail), JSON.stringify(newItems.map(a => a.label)));
  }, [userEmail]);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [holdingPath, setHoldingPath] = useState(null);
  const [holdCueActive, setHoldCueActive] = useState(false);
  const pressTimer = useRef(null);
  const cueTimer = useRef(null);

  const startHold = useCallback((path) => {
    if (editMode) return;
    setHoldingPath(path);
    cueTimer.current = setTimeout(() => setHoldCueActive(true), HOLD_CUE_MS);
    pressTimer.current = setTimeout(() => {
      setEditMode(true);
      setHoldingPath(null);
      setHoldCueActive(false);
    }, LONG_PRESS_MS);
  }, [editMode]);

  const cancelHold = useCallback(() => {
    clearTimeout(pressTimer.current);
    clearTimeout(cueTimer.current);
    setHoldingPath(null);
    setHoldCueActive(false);
  }, []);

  const exitEdit = useCallback(() => {
    setEditMode(false);
    setShowPicker(false);
  }, []);

  // Badge data
  const { data: reminders = [] } = useQuery({
    queryKey: ['dock-reminders'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 20),
    staleTime: 60_000,
  });
  const { data: conversations = [] } = useQuery({
    queryKey: ['dock-wa'],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 20),
    staleTime: 60_000,
  });

  const urgentCount = reminders.filter(r => r.due_at && new Date(r.due_at) < new Date()).length
    + conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const isUrgent = urgentCount > 0;
  const homeColor = isUrgent ? 'rgba(239,68,68,1)' : 'rgba(245,158,11,1)';
  const homeGlow  = isUrgent ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.45)';

  // DnD
  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    const next = [...items];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    persistItems(next);
  };

  const removeItem = (path) => {
    if (items.length <= MIN_ITEMS) return;
    persistItems(items.filter(i => i.path !== path));
  };

  const addItem = (app) => {
    if (items.length >= MAX_ITEMS) return;
    persistItems([...items, app]);
    setShowPicker(false);
  };

  // Split items into left/right of Home
  const half = Math.floor(items.length / 2);
  const leftItems  = items.slice(0, half);
  const rightItems = items.slice(half);
  const allIds = items.map(i => i.path);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-center" style={{ padding: '0 16px 14px' }}>
          {/* "Done" button above the pill */}
          {editMode && (
            <button
              onPointerDown={exitEdit}
              className="absolute text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                bottom: 'calc(env(safe-area-inset-bottom) + 90px)',
                background: 'rgba(245,158,11,0.18)',
                border: '1px solid rgba(245,158,11,0.35)',
                color: 'hsl(38 92% 55%)',
              }}
            >
              Done
            </button>
          )}

          <DragDropContext onDragEnd={onDragEnd}>
            <div
              style={{
                background: 'rgba(6,8,16,0.88)',
                backdropFilter: 'blur(48px) saturate(220%)',
                WebkitBackdropFilter: 'blur(48px) saturate(220%)',
                borderRadius: '32px',
                border: '1px solid rgba(255,255,255,0.10)',
                borderTopColor: 'rgba(255,255,255,0.18)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(245,159,10,0.08)',
                padding: '7px 14px 7px',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '4px',
              }}
            >
              {/* Left items */}
              <Droppable droppableId="nav-left" direction="horizontal" isDropDisabled={!editMode}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex items-end gap-1">
                    {leftItems.map((item, idx) => (
                      <Draggable key={item.path} draggableId={`nav-${item.path}`} index={idx} isDragDisabled={!editMode}>
                        {(p) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            onPointerDown={() => startHold(item.path)}
                            onPointerUp={cancelHold}
                            onPointerLeave={cancelHold}
                            onClick={() => { if (!editMode) navigate(item.path); }}
                            className={editMode && !false ? 'animate-wiggle' : ''}
                            style={{ position: 'relative' }}
                          >
                            <NavIcon
                              app={item}
                              active={!editMode && location.pathname === item.path}
                              editMode={editMode}
                              onRemove={() => removeItem(item.path)}
                              holdCue={holdingPath === item.path && holdCueActive}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Center Home — fixed anchor */}
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 2px' }}>
                {/* Contained bloom */}
                <div style={{
                  position: 'absolute',
                  width: HOME_SZ + 8, height: HOME_SZ + 8,
                  borderRadius: `${Math.round(HOME_SZ * 0.245) + 2}px`,
                  background: homeGlow,
                  filter: 'blur(10px)',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -58%)',
                  pointerEvents: 'none', zIndex: 0,
                  transition: 'background 0.4s ease',
                }} />
                {isUrgent && (
                  <div style={{
                    position: 'absolute',
                    width: HOME_SZ + 14, height: HOME_SZ + 14,
                    borderRadius: `${Math.round(HOME_SZ * 0.245) + 3}px`,
                    border: '2px solid rgba(239,68,68,0.50)',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -58%)',
                    pointerEvents: 'none', zIndex: 1,
                    animation: 'pulse 2s ease-in-out infinite',
                  }} />
                )}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  aria-label="Home"
                  style={{
                    width: HOME_SZ, height: HOME_SZ,
                    borderRadius: HOME_R,
                    position: 'relative',
                    top: isHome ? '-12px' : '-8px',
                    zIndex: 2,
                    border: `2px solid ${isHome ? homeColor.replace('1)', '0.50)') : homeColor.replace('1)', '0.25)')}`,
                    borderTopColor: `rgba(255,255,255,${isHome ? '0.55' : '0.30'})`,
                    boxShadow: isHome
                      ? `0 12px 36px ${homeGlow}, 0 4px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22)`
                      : `0 6px 20px ${homeGlow.replace('0.45', '0.20')}, 0 2px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.14)`,
                    background: isHome ? homeColor.replace('1)', '0.18)') : homeColor.replace('1)', '0.09)'),
                    backdropFilter: 'blur(32px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                    cursor: 'pointer',
                    transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: HOME_R,
                    background: isUrgent
                      ? 'linear-gradient(145deg, rgba(239,68,68,0.55) 0%, rgba(180,20,20,0.40) 100%)'
                      : 'linear-gradient(145deg, rgba(245,158,11,0.55) 0%, rgba(180,100,0,0.40) 100%)',
                    transition: 'background 0.4s ease',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: HOME_R,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 52%)',
                    pointerEvents: 'none',
                  }} />
                  {isUrgent && (
                    <div style={{
                      position: 'absolute', top: -5, right: -5,
                      background: 'rgb(239,68,68)', color: '#fff',
                      fontSize: 8, fontWeight: 700,
                      minWidth: 16, height: 16, borderRadius: 99,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid rgba(6,8,16,0.9)', zIndex: 5, padding: '0 3px',
                    }}>{urgentCount > 99 ? '99+' : urgentCount}</div>
                  )}
                  <Home style={{
                    width: HOME_GLYPH, height: HOME_GLYPH,
                    position: 'relative', zIndex: 2,
                    color: isUrgent ? 'hsl(0 84% 65%)' : 'hsl(38 92% 55%)',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.60))',
                    strokeWidth: 2.2,
                    transition: 'color 0.4s ease',
                  }} />
                </button>
                <span style={{
                  fontSize: 9, fontWeight: isHome ? 700 : 400,
                  color: isHome ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.40)',
                  letterSpacing: '0.02em', marginTop: 2,
                  transition: 'color 0.22s ease',
                }}>Home</span>
              </div>

              {/* Right items */}
              <Droppable droppableId="nav-right" direction="horizontal" isDropDisabled={!editMode}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex items-end gap-1">
                    {rightItems.map((item, idx) => (
                      <Draggable key={item.path} draggableId={`nav-${item.path}`} index={idx} isDragDisabled={!editMode}>
                        {(p) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            onPointerDown={() => startHold(item.path)}
                            onPointerUp={cancelHold}
                            onPointerLeave={cancelHold}
                            onClick={() => { if (!editMode) navigate(item.path); }}
                            className={editMode ? 'animate-wiggle' : ''}
                            style={{ position: 'relative' }}
                          >
                            <NavIcon
                              app={item}
                              active={!editMode && location.pathname === item.path}
                              editMode={editMode}
                              onRemove={() => removeItem(item.path)}
                              holdCue={holdingPath === item.path && holdCueActive}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Add slot — shown in edit mode if under max */}
              {editMode && items.length < MAX_ITEMS && (
                <button
                  onPointerDown={() => setShowPicker(true)}
                  className="flex flex-col items-center gap-[3px] select-none"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div style={{
                    width: SZ, height: SZ, borderRadius: R,
                    border: '1.5px dashed rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                  }}>
                    <Plus className="w-5 h-5 text-white/40" strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)' }}>Add</span>
                </button>
              )}
            </div>
          </DragDropContext>
        </div>
      </nav>

      {showPicker && (
        <AppPickerSheet
          currentItems={items}
          onAdd={addItem}
          onClose={() => setShowPicker(false)}
          title="Add to Nav Bar"
        />
      )}
    </>
  );
}