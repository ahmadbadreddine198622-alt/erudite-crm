import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Crown, Target, Building2, DollarSign, MessageCircle, Brain, Users, Wrench } from 'lucide-react';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import { ALL_APPS } from '@/lib/navApps';

// ── Folder definitions ────────────────────────────────────────────────────────
// Maps exact app labels to folders. Apps not listed fall into Tools & Reference.
const FOLDER_DEFS = [
  {
    id: 'ceo',
    name: 'CEO & Admin',
    icon: Crown,
    jewelColor: '#f0d98a',
    jewelAura: 'rgba(212,175,55,.55)',
    appLabels: ['Company Settings', 'Brand Settings', 'Team Management', 'Analytics', 'Finance', 'Policies & HR', 'Design System', 'Team AI OS', 'Team Performance', 'Agent Intelligence', 'Team Dashboard', 'Dubai Intelligence', 'Cheque Register', 'Command Center'],
  },
  {
    id: 'leads',
    name: 'Leads & Pipeline',
    icon: Target,
    jewelColor: '#c4b1ff',
    jewelAura: 'rgba(139,92,246,.62)',
    appLabels: ['Pipeline', 'Leads', 'PF Leads', 'Instagram Leads', 'Meta & Google', 'Duplicate Detector', 'Contacts'],
  },
  {
    id: 'landlords',
    name: 'Landlords & Listings',
    icon: Building2,
    jewelColor: '#f5c878',
    jewelAura: 'rgba(240,169,59,.58)',
    appLabels: ['Landlords', 'Listing Production', 'Photography', 'Matterport Sync', 'Property Finder', 'Find Property', 'Property Intel', 'Form A Referral', 'Form I Generator'],
  },
  {
    id: 'deals',
    name: 'Deals & Money',
    icon: DollarSign,
    jewelColor: '#7ce8c4',
    jewelAura: 'rgba(45,212,167,.58)',
    appLabels: ['Closing', 'Closing AI', 'Finance', 'Commissions', 'Cheques', 'Offers', 'Negotiations', 'Deal Risk', 'Transfer Calculator', 'Transfer Numbers', 'Key Handover'],
  },
  {
    id: 'comms',
    name: 'Comms',
    icon: MessageCircle,
    jewelColor: '#9bb9ff',
    jewelAura: 'rgba(61,109,246,.58)',
    appLabels: ['WhatsApp', 'WhatsApp Hub', 'WhatsApp Setup', 'Messages', 'Broadcasts', 'Email Templates', 'Email Automations', 'Inbox', 'Twilio Hub'],
  },
  {
    id: 'analytics',
    name: 'Analytics & AI',
    icon: Brain,
    jewelColor: '#7fe6f5',
    jewelAura: 'rgba(34,211,238,.58)',
    appLabels: ['Analytics', 'Sales Analytics', 'Team Performance', 'Market Intelligence', 'Buyer Match AI', 'Claude AI', 'Team AI OS', 'Dubai Intelligence', 'Command Center'],
  },
  {
    id: 'team',
    name: 'Team & HR',
    icon: Users,
    jewelColor: '#f7a9d0',
    jewelAura: 'rgba(244,114,182,.55)',
    appLabels: ['Team', 'Team Management', 'Policies & HR', 'PF Agent Profile', 'Acknowledgements'],
  },
  {
    id: 'tools',
    name: 'Tools & Reference',
    icon: Wrench,
    jewelColor: '#c3ccdd',
    jewelAura: 'rgba(154,166,192,.45)',
    appLabels: ['Map View', 'DLD Lookup', 'Lease Agreement', 'Tenancy Contracts', 'Notes', 'Viewings', 'Follow Ups', 'Reminders', 'Calendar', 'Projects', 'Google Drive', 'Brand Settings', 'Company Settings'],
  },
];

// Build a label→app lookup
const APP_BY_LABEL = Object.fromEntries(ALL_APPS.map(a => [a.label, a]));

// Resolve folder apps — only include labels that exist in ALL_APPS
function resolveFolderApps(labelList) {
  return labelList.map(l => APP_BY_LABEL[l]).filter(Boolean);
}

// Collect any ALL_APPS entries not assigned to any folder
const assignedLabels = new Set(FOLDER_DEFS.flatMap(f => f.appLabels));
const unassignedApps = ALL_APPS.filter(a => !assignedLabels.has(a.label));

// Merge unassigned into Tools & Reference (last folder)
const FOLDERS = FOLDER_DEFS.map((f, i) => {
  const apps = resolveFolderApps(f.appLabels);
  if (i === FOLDER_DEFS.length - 1 && unassignedApps.length > 0) {
    const existingLabels = new Set(apps.map(a => a.label));
    const extras = unassignedApps.filter(a => !existingLabels.has(a.label));
    return { ...f, apps: [...apps, ...extras] };
  }
  return { ...f, apps };
});

// Missing labels report (for debugging — labels requested but not in ALL_APPS)
export const MISSING_APP_LABELS = FOLDER_DEFS
  .flatMap(f => f.appLabels)
  .filter(l => !APP_BY_LABEL[l]);

// ── Icon case (92px rounded case with colored aura) ───────────────────────────
function IconCase({ folder }) {
  const Icon = folder.icon;
  return (
    <div
      className="flex items-center justify-center transition-all duration-200"
      style={{
        width: '92px',
        height: '92px',
        borderRadius: '22px',
        background: `radial-gradient(circle at 50% 35%, ${folder.jewelAura} 0%, transparent 70%)`,
        boxShadow: `0 0 28px ${folder.jewelAura}, inset 0 0 18px ${folder.jewelAura}`,
      }}
    >
      {Icon && <Icon style={{ width: 44, height: 44, color: folder.jewelColor, strokeWidth: 1.75 }} />}
    </div>
  );
}

// ── App icon inside overlay (mini lit case) ───────────────────────────────────

// Extract RGB triplet + a light tint from an rgba glowColor string
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

function FolderAppIcon({ app, badges, onNavigate }) {
  const Icon = app.icon;
  const badgeCount = app.badgeKey ? (badges[app.badgeKey] || 0) : 0;
  const hue = hueParts(app.glowColor);

  return (
    <button
      onClick={() => onNavigate(app)}
      className="flex flex-col items-center gap-2 select-none focus:outline-none"
      style={{ cursor: 'pointer' }}
    >
      {/* Mini lit case */}
      <div
        className="relative flex items-center justify-center transition-all duration-200"
        style={{
          width: '66px',
          height: '66px',
          borderRadius: '19px',
          background: `radial-gradient(130% 130% at 30% 18%, rgba(${hue.rgb},0.22), rgba(${hue.rgb},0.05))`,
          border: '1px solid rgba(212,175,55,0.24)',
          boxShadow: `0 0 32px -8px rgba(${hue.rgb},0.55), inset 0 1px 0 rgba(255,255,255,0.16)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = `0 0 40px -6px rgba(${hue.rgb},0.7), inset 0 1px 0 rgba(255,255,255,0.2)`;
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = `0 0 32px -8px rgba(${hue.rgb},0.55), inset 0 1px 0 rgba(255,255,255,0.16)`;
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.24)';
        }}
      >
        {Icon ? (
          <Icon style={{ width: '30px', height: '30px', strokeWidth: 1.5, color: hue.light }} />
        ) : (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>?</span>
        )}
        {/* Badge */}
        {badgeCount > 0 && (
          <div
            className="absolute -top-1 -right-1 z-10 min-w-[18px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-0.5 shadow-lg"
            style={{ background: '#d4af37', color: '#0a0e1a' }}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </div>
        )}
      </div>
      {/* Label */}
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '11.5px',
          fontWeight: 500,
          color: '#e8ecf6',
          textAlign: 'center',
          lineHeight: 1.25,
          maxWidth: '72px',
          minHeight: '2.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        {app.label}
      </span>
    </button>
  );
}

// ── Folder tile ───────────────────────────────────────────────────────────────
function FolderTile({ folder, badges, onOpen }) {
  const totalBadge = folder.apps.reduce((sum, app) => {
    return sum + (app.badgeKey ? (badges[app.badgeKey] || 0) : 0);
  }, 0);

  return (
    <button
      onClick={() => onOpen(folder.id)}
      className="group active:scale-[0.98] focus:outline-none transition-all duration-200"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Tile — glass card with jewel aura */}
      <div
        className="relative overflow-hidden flex flex-col items-center justify-center gap-2 p-4 transition-all duration-200"
        style={{
          width: '100%',
          minHeight: '140px',
          background: 'var(--ds-card, rgba(255,255,255,0.022))',
          border: '1px solid var(--ds-card-line, rgba(255,255,255,0.07))',
          borderRadius: '18px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-6px)';
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)';
          e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.4), 0 0 24px ${folder.jewelAura}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'var(--ds-card-line, rgba(255,255,255,0.07))';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Aggregate badge */}
        {totalBadge > 0 && (
          <div
            className="absolute top-2 right-2 z-10 min-w-[18px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-0.5 shadow-lg"
            style={{ background: 'var(--ds-gold, #d4af37)', color: '#0a0e1a' }}
          >
            {totalBadge > 99 ? '99+' : totalBadge}
          </div>
        )}
        <IconCase folder={folder} />
      </div>
      {/* Label */}
      <span
        className="text-[10px] text-center font-medium mt-1.5 block"
        style={{
          fontFamily: 'var(--font-sans)',
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.03em',
          lineHeight: '1.2',
        }}
      >
        {folder.name}
      </span>
    </button>
  );
}

// ── Folder overlay (lit display case) ─────────────────────────────────────────
function FolderOverlay({ folder, badges, tilt, onClose, onNavigate }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
      style={{
        background: 'rgba(6,8,15,0.62)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-h-[85vh] overflow-y-auto"
        style={{
          maxWidth: '560px',
          background: 'rgba(16,20,32,0.72)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(212,175,55,0.16)',
          borderRadius: '24px',
          boxShadow: '0 40px 90px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '30px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold hairline top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
            marginLeft: '26px',
            marginRight: '26px',
          }}
        />

        {/* ERUDITE logo eyebrow */}
        <div className="flex items-center gap-2 mb-4">
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '0.30em',
              background: 'linear-gradient(92deg, #eccd72, #d4af37 55%, #b8862b)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            ERUDITE
          </span>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '11px' }}>·</span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '8px',
              letterSpacing: '0.36em',
              fontWeight: 700,
              color: '#5d6680',
            }}
          >
            REAL ESTATE · DUBAI
          </span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: '24px',
                color: folder.jewelColor,
                lineHeight: 1.1,
              }}
            >
              {folder.name}
            </h2>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
                color: '#8a93ab',
                marginTop: '4px',
              }}
            >
              {folder.apps.length} apps
            </p>
          </div>
          {/* Close button — 36px glass circle */}
          <button
            onClick={onClose}
            className="flex items-center justify-center transition-all shrink-0"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: '#8a93ab',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)';
              e.currentTarget.style.color = '#e8ecf6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
              e.currentTarget.style.color = '#8a93ab';
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* App grid — 5 columns, 22px gaps */}
        <div className="grid grid-cols-5" style={{ gap: '22px' }}>
          {folder.apps.map((app) => (
            <FolderAppIcon
              key={app.label}
              app={app}
              badges={badges}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {/* Faint ERUDITE watermark */}
        <div
          className="absolute bottom-3 right-5 pointer-events-none select-none"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: '52px',
            letterSpacing: '0.20em',
            color: 'rgba(255,255,255,0.03)',
            lineHeight: 1,
          }}
        >
          E
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AppFolderGrid({ badges = {}, tilt = { x: 0, y: 0 } }) {
  const navigate = useNavigate();
  const [openFolder, setOpenFolder] = useState(null);

  const activeFolder = openFolder ? FOLDERS.find(f => f.id === openFolder) : null;

  const handleNavigate = (app) => {
    setOpenFolder(null);
    if (app.href) {
      window.open(app.href, '_blank');
    } else {
      navigate(app.path);
    }
  };

  return (
    <>
      {/* Folder grid — 4 columns, 18px gutters */}
      <div
        className="w-full grid grid-cols-2 sm:grid-cols-4"
        style={{
          gap: '18px',
          paddingTop: '8px',
          paddingBottom: '4px',
        }}
      >
        {FOLDERS.map(folder => (
          <FolderTile
            key={folder.id}
            folder={folder}
            badges={badges}
            onOpen={setOpenFolder}
          />
        ))}
      </div>

      {/* Overlay */}
      {activeFolder && (
        <FolderOverlay
          folder={activeFolder}
          badges={badges}
          tilt={tilt}
          onClose={() => setOpenFolder(null)}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}