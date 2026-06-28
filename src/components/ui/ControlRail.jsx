import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Menu, Command, ChevronRight, Sparkles, X } from 'lucide-react';

// ── Color tokens from design system ───────────────────────────────────────────
const COLORS = {
  gold: '#d4af37',
  goldLite: '#eccd72',
  goldDeep: '#b8862b',
  ink: '#e8ecf6',
  muted: '#8a93ab',
  mutedDim: '#5d6680',
  card: 'rgba(255,255,255,0.022)',
  cardLine: 'rgba(255,255,255,0.07)',
};

// ── Workspace definitions with jewel hues ─────────────────────────────────────
const WORKSPACES = [
  { name: 'CEO & Admin', path: '/company-settings', hueRgb: '212,175,55', hue: '#d4af37' },
  { name: 'Leads & Pipeline', path: '/pipeline', hueRgb: '139,92,246', hue: '#8b5cf6' },
  { name: 'Landlords & Listings', path: '/landlords', hueRgb: '240,169,59', hue: '#f0a93b' },
  { name: 'Deals & Money', path: '/closing', hueRgb: '45,212,167', hue: '#2dd4a7' },
  { name: 'Comms', path: '/whatsapp', hueRgb: '61,109,246', hue: '#3d6df6' },
  { name: 'Analytics & AI', path: '/analytics', hueRgb: '34,211,238', hue: '#22d3ee' },
  { name: 'Team & HR', path: '/team', hueRgb: '244,114,182', hue: '#f472b6' },
  { name: 'Tools & Reference', path: '/map', hueRgb: '154,166,192', hue: '#9aa6c0' },
];

// ── Helper: extract RGB from rgba string or return default ───────────────────
function hueParts(glowColor) {
  const m = (glowColor || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return { rgb: '154,166,192', light: 'rgb(195,204,221)' };
  const parts = m[1].split(',').map(s => parseInt(s.trim(), 10));
  const [r, g, b] = parts.length >= 3 ? parts : [154, 166, 192];
  const lr = Math.min(255, Math.round(r + (255 - r) * 0.65));
  const lg = Math.min(255, Math.round(g + (255 - g) * 0.65));
  const lb = Math.min(255, Math.round(b + (255 - b) * 0.65));
  return { rgb: `${r},${g},${b}`, light: `rgb(${lr},${lg},${lb})` };
}

// ── Lit Display Case Button ───────────────────────────────────────────────────
function LitButton({ icon: Icon, label, shortcut, hueRgb, gradient, onClick, isActive, isHero }) {
  const [hovered, setHovered] = useState(false);
  const hue = hueParts(`rgba(${hueRgb},1)`);
  
  return (
    <div className="relative flex items-center">
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex items-center justify-center transition-all duration-200 focus:outline-none"
        style={{
          width: isHero ? 52 : 48,
          height: isHero ? 52 : 48,
          borderRadius: 16,
          background: `radial-gradient(130% 130% at 30% 18%, ${gradient[0]}, ${gradient[1]} 70%, ${gradient[2]})`,
          border: `1px solid rgba(212,175,55,0.30)`,
          boxShadow: hovered
            ? `0 0 32px -6px rgba(${hueRgb},0.8), inset 0 1px 0 rgba(255,255,255,0.28)`
            : `0 0 24px -8px rgba(${hueRgb},0.6), inset 0 1px 0 rgba(255,255,255,0.22)`,
          transform: hovered ? 'translateY(-2px) scale(1.05)' : 'translateY(0) scale(1)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gold hairline edge inset */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: 16,
            boxShadow: 'inset 0 0 0 1px rgba(212,175,55,0.08)',
          }}
        />
        
        {/* Top glint */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: 10,
            left: 10,
            right: 10,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
          }}
        />
        
        {/* Inner top-glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(80% 50% at 50% -10%, rgba(255,255,255,0.24), transparent 70%)',
          }}
        />
        
        {/* Hero pulse ring (Command only) */}
        {isHero && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: 16,
              animation: 'heroPulse 3s ease-in-out infinite',
            }}
          />
        )}
        
        {/* Icon with gradient stroke */}
        <Icon
          width="22"
          height="22"
          style={{
            position: 'relative',
            zIndex: 2,
            strokeWidth: 1.7,
            stroke: `url(#iconGradient-${label})`,
          }}
        />
        <svg width="0" height="0">
          <defs>
            <linearGradient id={`iconGradient-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={hue.light} />
              <stop offset="100%" stopColor={`rgb(${hueRgb})`} />
            </linearGradient>
          </defs>
        </svg>
      </button>
      
      {/* Hover label */}
      {hovered && (
        <div
          className="absolute left-full ml-2 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap"
          style={{
            background: 'rgba(16,20,32,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(212,175,55,0.20)',
            borderRadius: 11,
            animation: 'labelSlide 0.15s ease-out',
          }}
        >
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.ink }}>{label}</span>
          {shortcut && (
            <kbd
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: COLORS.muted,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
}

// ── Menu Flyout (Workspaces) ─────────────────────────────────────────────────
function MenuFlyout({ isOpen, onClose }) {
  const navigate = useNavigate();
  const flyoutRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-[59]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      
      {/* Flyout panel */}
      <div
        ref={flyoutRef}
        className="fixed z-[60] p-5 overflow-hidden"
        style={{
          left: 74,
          top: 12,
          width: 288,
          background: 'rgba(16,20,32,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(212,175,55,0.16)',
          borderRadius: 20,
          boxShadow: '0 40px 90px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
          animation: 'flyoutSlide 0.18s ease-out',
        }}
      >
        {/* Gold hairline top */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
            marginLeft: 26,
            marginRight: 26,
          }}
        />
        
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-3">
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: '0.28em',
              color: COLORS.goldLite,
              textTransform: 'uppercase',
            }}
          >
            Workspaces
          </span>
        </div>
        
        {/* Workspace rows */}
        <div className="flex flex-col gap-1.5">
          {WORKSPACES.map((ws) => (
            <button
              key={ws.path}
              onClick={() => { navigate(ws.path); onClose(); }}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-all hover:bg-white/5"
              style={{
                cursor: 'pointer',
              }}
            >
              {/* Hue chip */}
              <div
                className="shrink-0 rounded-lg flex items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: `radial-gradient(130% 130% at 30% 18%, rgba(${ws.hueRgb},0.35), rgba(${ws.hueRgb},0.12) 70%, rgba(${ws.hueRgb},0.06))`,
                  border: '1px solid rgba(212,175,55,0.25)',
                  boxShadow: `0 0 16px -6px rgba(${ws.hueRgb},0.5)`,
                }}
              />
              {/* Name */}
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  color: COLORS.ink,
                  fontWeight: 500,
                }}
              >
                {ws.name}
              </span>
              {/* Chevron */}
              <ChevronRight
                className="ml-auto shrink-0"
                style={{ width: 14, height: 14, color: COLORS.muted }}
              />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Command Flyout (⌘K Palette) ──────────────────────────────────────────────
function CommandFlyout({ isOpen, onClose, onAddLead, onNewListing }) {
  const flyoutRef = useRef(null);
  const [query, setQuery] = useState('');
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-[59]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      
      {/* Flyout panel */}
      <div
        ref={flyoutRef}
        className="fixed z-[60] p-5 overflow-hidden"
        style={{
          left: 74,
          top: 12,
          width: 380,
          background: 'rgba(16,20,32,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(212,175,55,0.16)',
          borderRadius: 20,
          boxShadow: '0 40px 90px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
          animation: 'flyoutSlide 0.18s ease-out',
        }}
      >
        {/* Gold hairline top */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
            marginLeft: 26,
            marginRight: 26,
          }}
        />
        
        {/* Search input */}
        <div className="mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, ask, or run a command…"
            className="w-full px-3 py-2.5 rounded-xl outline-none"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              color: COLORS.ink,
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
            }}
          />
          <div className="flex items-center gap-1 mt-2">
            <kbd
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: COLORS.muted,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              esc
            </kbd>
            <span style={{ fontSize: 10, color: COLORS.mutedDim }}>to close</span>
          </div>
        </div>
        
        {/* Quick actions */}
        <div className="mb-4">
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 9,
              letterSpacing: '0.25em',
              color: COLORS.muted,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Quick Actions
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { onAddLead(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'radial-gradient(130% 130% at 30% 18%, rgba(45,212,167,0.35), rgba(45,212,167,0.12))',
                  border: '1px solid rgba(212,175,55,0.25)',
                }}
              >
                <span style={{ fontSize: 16, color: '#2dd4a7' }}>+</span>
              </div>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.ink }}>
                Add a lead
              </span>
              <kbd
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: COLORS.muted,
                  fontFamily: "'Inter', sans-serif",
                  marginLeft: 'auto',
                }}
              >
                ⌘L
              </kbd>
            </button>
            
            <button
              onClick={() => { onNewListing(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'radial-gradient(130% 130% at 30% 18%, rgba(240,169,59,0.35), rgba(240,169,59,0.12))',
                  border: '1px solid rgba(212,175,55,0.25)',
                }}
              >
                <span style={{ fontSize: 16, color: '#f0a93b' }}>🏠</span>
              </div>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.ink }}>
                New listing
              </span>
              <kbd
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: COLORS.muted,
                  fontFamily: "'Inter', sans-serif",
                  marginLeft: 'auto',
                }}
              >
                ⌘N
              </kbd>
            </button>
          </div>
        </div>
        
        {/* Ask ERUDITE */}
        <div>
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 9,
              letterSpacing: '0.25em',
              color: COLORS.muted,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Ask ERUDITE
          </p>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
            style={{
              background: 'rgba(212,175,55,0.06)',
              border: '1px solid rgba(212,175,55,0.15)',
              cursor: 'pointer',
            }}
          >
            <Sparkles
              className="shrink-0"
              style={{ width: 18, height: 18, color: COLORS.goldLite }}
            />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.ink }}>
              Summarize today's hot leads
            </span>
            <kbd
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: COLORS.muted,
                fontFamily: "'Inter', sans-serif",
                marginLeft: 'auto',
              }}
            >
              ↵
            </kbd>
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Control Rail Component ──────────────────────────────────────────────
export default function ControlRail({ onAddLead, onNewListing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  
  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ⌘K / Ctrl+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(prev => !prev);
        setMenuOpen(false);
      }
      // ⌘L / Ctrl+L: Add lead
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        onAddLead?.();
      }
      // ⌘N / Ctrl+N: New listing
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        onNewListing?.();
      }
      // Esc: close flyouts
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAddLead, onNewListing]);
  
  return (
    <>
      {/* CSS animations */}
      <style>{`
        @keyframes heroPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); }
        }
        @keyframes labelSlide {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes flyoutSlide {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
      
      {/* Rail container */}
      <div
        className="fixed z-[70] p-2"
        style={{
          top: 12,
          left: 12,
          background: 'rgba(16,20,32,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(212,175,55,0.14)',
          borderRadius: 16,
          boxShadow: '0 24px 50px -30px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Gold hairline top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
            marginLeft: 14,
            marginRight: 14,
          }}
        />
        
        {/* Buttons column */}
        <div
          className="flex flex-col items-center gap-2 relative"
          style={{ paddingTop: 6, paddingBottom: 6 }}
        >
          {/* HOME */}
          <LitButton
            icon={Home}
            label="Dashboard"
            hueRgb="212,175,55"
            gradient={['#4a3a14', '#2a1f0a', '#160f05']}
            onClick={() => navigate('/')}
          />
          
          {/* Divider */}
          <div
            style={{
              width: '100%',
              height: 1,
              background: 'rgba(212,175,55,0.12)',
            }}
          />
          
          {/* MENU */}
          <LitButton
            icon={Menu}
            label="Workspaces"
            hueRgb="96,124,170"
            gradient={['#222f45', '#151d2b', '#0b111c']}
            onClick={() => { setMenuOpen(true); setCommandOpen(false); }}
          />
          
          {/* COMMAND (hero) */}
          <LitButton
            icon={Command}
            label="Command"
            shortcut="⌘K"
            hueRgb="139,92,246"
            gradient={['#372563', '#221540', '#120a26']}
            onClick={() => { setCommandOpen(true); setMenuOpen(false); }}
            isHero
          />
        </div>
      </div>
      
      {/* Flyouts */}
      <MenuFlyout isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <CommandFlyout
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        onAddLead={onAddLead}
        onNewListing={onNewListing}
      />
    </>
  );
}