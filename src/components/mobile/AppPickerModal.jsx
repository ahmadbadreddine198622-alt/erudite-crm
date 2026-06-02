/**
 * AppPickerModal — Full-screen app grid with dock customizer.
 * Shows searchable grid of all apps + dock preview at bottom.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MoreVertical, Home } from 'lucide-react';
import { ALL_APPS } from '@/lib/navApps';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';

const DOCK_SIZE = 50;
const DOCK_RADIUS = '16px';
const GRID_SIZE = 70;
const GRID_RADIUS = '18px';

function loadDockSelection() {
  try {
    return JSON.parse(localStorage.getItem('dock_selection') || 'null')
      || ['pipeline', 'leads', 'contacts', 'whatsapp'];
  } catch { return ['pipeline', 'leads', 'contacts', 'whatsapp']; }
}

function saveDockSelection(paths) {
  try { localStorage.setItem('dock_selection', JSON.stringify(paths)); } catch {}
}

function timeDisplay() {
  const now = new Date();
  const hours = String(now.getHours() % 12 || 12).padStart(2, '0');
  const mins  = String(now.getMinutes()).padStart(2, '0');
  const period = now.getHours() >= 12 ? 'PM' : 'AM';
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][now.getMonth()];
  return { time: `${hours}:${mins}`, period, date: `${dayName}, ${monthName} ${now.getDate()}` };
}

function AppIcon({ app, size, radius, iconSize, isSelected, onSelect, isDock }) {
  const { icon: Icon, label, gradient, glowColor } = app;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(app.path)}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent', position: 'relative',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isDock ? 4 : 8 }}>
        <div style={{ position: 'relative' }}>
          <ExtremeLiquidIcon
            icon={Icon}
            gradient={gradient}
            glowColor={glowColor || 'rgba(255,255,255,0.25)'}
            size={size}
            iconSize={iconSize}
            active={isSelected}
            badge={0}
            tiltX={0}
            tiltY={0}
            index={0}
            isDragging={false}
          />
          {isSelected && !isDock && (
            <div style={{
              position: 'absolute', top: -8, right: -8,
              width: 20, height: 20, borderRadius: '50%',
              background: 'rgba(34,197,94,0.85)', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 12, fontWeight: 700, zIndex: 10,
            }}>✓</div>
          )}
        </div>
        {!isDock && (
          <span style={{
            fontSize: 11, fontWeight: isSelected ? 600 : 400,
            color: isSelected ? 'hsl(38 92% 65%)' : 'rgba(255,255,255,0.50)',
            letterSpacing: '0.03em', textAlign: 'center',
            maxWidth: size + 10, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>{label}</span>
        )}
      </div>
    </button>
  );
}

export default function AppPickerModal({ onClose }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dockSelection, setDockSelection] = useState(() => loadDockSelection());
  const [editMode, setEditMode] = useState(false);
  const [time, setTime] = useState(timeDisplay);

  useEffect(() => {
    const timer = setInterval(() => setTime(timeDisplay), 10000);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_APPS.filter(app => !app.href && app.label.toLowerCase().includes(q));
  }, [search]);

  const dockApps = useMemo(() => {
    const selected = dockSelection.slice(0, 4);
    return selected.map(path => ALL_APPS.find(a => a.path === path)).filter(Boolean);
  }, [dockSelection]);

  const handleSelectDock = (path) => {
    if (editMode) {
      if (dockSelection.includes(path)) {
        setDockSelection(prev => prev.filter(p => p !== path));
      } else if (dockSelection.length < 4) {
        setDockSelection(prev => [...prev, path]);
      }
    }
  };

  const handleSaveDock = () => {
    saveDockSelection(dockSelection);
    setEditMode(false);
  };

  const handleNav = (path) => {
    navigate(path);
    onClose?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0e1e', zIndex: 9998,
      overflow: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 12px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <X style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.60)' }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>erudite-dashboard</span>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <MoreVertical style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.60)' }} />
        </button>
      </div>

      {/* Time display */}
      <div style={{
        padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 4 }}>
          {time.time}
          <span style={{ fontSize: 32, marginLeft: 6, color: 'hsl(38 92% 55%)' }}>{time.period}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'hsl(38 92% 55%)', marginTop: 8 }}>
          {time.date}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '16px 12px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search apps"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.80)', fontSize: 14,
            outline: 'none', caretColor: 'hsl(38 92% 55%)',
          }}
        />
      </div>

      {/* Edit Dock button */}
      {!editMode && (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={() => setEditMode(true)}
            style={{
              background: 'none', border: 'none', color: 'hsl(38 92% 55%)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em',
            }}
          >
            Edit Dock →
          </button>
        </div>
      )}

      {/* App grid */}
      <div style={{
        flex: 1, padding: '12px', overflow: 'auto',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16, placeItems: 'center',
      }}>
        {filtered.map(app => (
          <AppIcon
            key={app.path}
            app={app}
            size={GRID_SIZE}
            radius={GRID_RADIUS}
            iconSize={36}
            isSelected={dockSelection.includes(app.path) && editMode}
            onSelect={editMode ? handleSelectDock : () => handleNav(app.path)}
          />
        ))}
      </div>

      {/* Bottom dock */}
      <div style={{
        padding: '12px', background: 'linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.80) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 12, padding: '12px 0',
        }}>
          {/* Left 2 */}
          {dockApps.slice(0, 2).map(app => (
            <button
              key={app.path}
              onClick={() => handleNav(app.path)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <AppIcon
                app={app}
                size={DOCK_SIZE}
                radius={DOCK_RADIUS}
                iconSize={28}
                isDock
              />
            </button>
          ))}

          {/* Home center */}
          <button
            onClick={() => navigate('/')}
            style={{
              width: DOCK_SIZE, height: DOCK_SIZE, borderRadius: DOCK_RADIUS,
              background: 'linear-gradient(135deg, rgba(245,158,11,0.30) 0%, rgba(180,90,0,0.15) 100%)',
              border: '1.5px solid rgba(245,158,11,0.40)', borderTopColor: 'rgba(255,255,255,0.40)',
              backdropFilter: 'blur(20px)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'all 0.22s ease',
              boxShadow: '0 4px 16px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.40) 0%, rgba(180,90,0,0.25) 100%)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.25), inset 0 1px 0 rgba(255,255,255,0.20)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.30) 0%, rgba(180,90,0,0.15) 100%)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.15)';
            }}
          >
            <Home style={{ width: 26, height: 26, color: 'hsl(38 92% 60%)', strokeWidth: 2.2 }} />
          </button>

          {/* Right 2 */}
          {dockApps.slice(2, 4).map(app => (
            <button
              key={app.path}
              onClick={() => handleNav(app.path)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <AppIcon
                app={app}
                size={DOCK_SIZE}
                radius={DOCK_RADIUS}
                iconSize={28}
                isDock
              />
            </button>
          ))}
        </div>

        {/* Dock labels */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 12, marginTop: 4,
        }}>
          {dockApps.slice(0, 2).map(app => (
            <span key={app.path} style={{
              fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              width: DOCK_SIZE, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>{app.label}</span>
          ))}
          <span style={{ fontSize: 9, fontWeight: 700, color: 'hsl(38 92% 55%)', textTransform: 'uppercase', letterSpacing: '0.05em', width: DOCK_SIZE, textAlign: 'center' }}>Home</span>
          {dockApps.slice(2, 4).map(app => (
            <span key={app.path} style={{
              fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              width: DOCK_SIZE, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>{app.label}</span>
          ))}
        </div>

        {/* Edit mode buttons */}
        {editMode && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
            <button
              onClick={() => setEditMode(false)}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
                color: 'rgba(255,255,255,0.80)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDock}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: 'hsl(38 92% 50%)', border: 'none',
                color: '#0a0e1e', cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}