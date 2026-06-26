import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import { ALL_APPS } from '@/lib/navApps';

// ── Folder definitions ────────────────────────────────────────────────────────
// Maps exact app labels to folders. Apps not listed fall into Tools & Reference.
const FOLDER_DEFS = [
  {
    id: 'ceo',
    name: 'CEO & Admin',
    emoji: '👑',
    appLabels: ['Company Settings', 'Brand Settings', 'Team Management', 'Analytics', 'Finance', 'Policies & HR', 'Design System', 'Team AI OS', 'Team Performance', 'Agent Intelligence', 'Team Dashboard', 'Dubai Intelligence', 'Cheque Register', 'Command Center'],
  },
  {
    id: 'leads',
    name: 'Leads & Pipeline',
    emoji: '🎯',
    appLabels: ['Pipeline', 'Leads', 'PF Leads', 'Instagram Leads', 'Meta & Google', 'Duplicate Detector', 'Contacts'],
  },
  {
    id: 'landlords',
    name: 'Landlords & Listings',
    emoji: '🏢',
    appLabels: ['Landlords', 'Listing Production', 'Photography', 'Matterport Sync', 'Property Finder', 'Find Property', 'Property Intel', 'Form A Referral', 'Form I Generator'],
  },
  {
    id: 'deals',
    name: 'Deals & Money',
    emoji: '💰',
    appLabels: ['Closing', 'Closing AI', 'Finance', 'Commissions', 'Cheques', 'Offers', 'Negotiations', 'Deal Risk', 'Transfer Calculator', 'Transfer Numbers', 'Key Handover'],
  },
  {
    id: 'comms',
    name: 'Comms',
    emoji: '💬',
    appLabels: ['WhatsApp', 'WhatsApp Hub', 'WhatsApp Setup', 'Messages', 'Broadcasts', 'Email Templates', 'Email Automations', 'Inbox', 'Twilio Hub'],
  },
  {
    id: 'analytics',
    name: 'Analytics & AI',
    emoji: '🧠',
    appLabels: ['Analytics', 'Sales Analytics', 'Team Performance', 'Market Intelligence', 'Buyer Match AI', 'Claude AI', 'Team AI OS', 'Dubai Intelligence', 'Command Center'],
  },
  {
    id: 'team',
    name: 'Team & HR',
    emoji: '👥',
    appLabels: ['Team', 'Team Management', 'Policies & HR', 'PF Agent Profile', 'Acknowledgements'],
  },
  {
    id: 'tools',
    name: 'Tools & Reference',
    emoji: '🛠️',
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

// ── Folder thumbnail (2×2 mini icons) ────────────────────────────────────────
function FolderThumbnail({ apps }) {
  const preview = apps.slice(0, 4);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '3px',
        padding: '4px',
        width: '68px',
        height: '68px',
        borderRadius: '10px',
        background: 'rgba(22,29,43,0.6)',
        border: '1px solid rgba(201,161,74,0.15)',
        boxSizing: 'border-box',
        WebkitBoxSizing: 'border-box',
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => {
        const app = preview[i];
        if (!app) return (
          <div key={i} style={{ borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }} />
        );
        const Icon = app.icon;
        // Parse gradient colors for Safari-compatible inline styles
        const getGradient = (gradient) => {
          // All icons use the ERUDITE gold gradient
          return 'linear-gradient(135deg, #F5E6B8 0%, #C9A14A 50%, #8A6D2F 100%)';
        };
        return (
          <div
            key={app.label}
            style={{
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              background: getGradient(app.gradient),
            }}
          >
            {/* Use a simple coloured square with the icon — lightweight vs full ExtremeLiquidIcon */}
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {Icon ? (
                <Icon style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.95)', strokeWidth: 2.5 }} />
              ) : (
                <span style={{ fontSize: '5px', color: 'rgba(255,255,255,0.3)' }}>?</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── App icon inside overlay ───────────────────────────────────────────────────
function FolderAppIcon({ app, badges, tilt, onNavigate }) {
  const Icon = app.icon;
  const badgeCount = app.badgeKey ? (badges[app.badgeKey] || 0) : 0;
  // Guard: if icon is undefined, render a simple fallback square instead of crashing
  if (!Icon) {
    return (
      <button
        onClick={() => onNavigate(app)}
        className="flex flex-col items-center gap-1 select-none focus:outline-none transition-transform active:scale-95"
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-slate-600 to-slate-800 border border-white/10"
        >
          <span className="text-xs text-white/40">?</span>
        </div>
        <span className="text-[10px] text-center leading-tight max-w-[56px] font-medium text-white/75 min-h-[1.8rem] flex items-start justify-center">
          {app.label}
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={() => onNavigate(app)}
      className="flex flex-col items-center gap-1 select-none focus:outline-none transition-transform active:scale-95"
    >
      <ExtremeLiquidIcon
        icon={Icon}
        gradient={app.gradient}
        glowColor={app.glowColor}
        tiltX={tilt.x}
        tiltY={tilt.y}
        index={0}
        isDragging={false}
        active={false}
        badge={badgeCount > 0 ? badgeCount : 0}
        size={48}
        iconSize={24}
      />
      <span className="text-[10px] text-center leading-tight max-w-[56px] font-medium text-white/75 min-h-[1.8rem] flex items-start justify-center">
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
      {/* Tile - minimalist dark card */}
      <div
        className="relative rounded-2xl p-3 flex flex-col items-center justify-center gap-2"
        style={{
          width: '100%',
          minHeight: '104px',
          background: 'rgba(22,29,43,0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid hsl(38 92% 55% / 0.15)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(22,29,43,1)';
          e.currentTarget.style.borderColor = 'hsl(38 92% 55% / 0.3)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(22,29,43,0.95)';
          e.currentTarget.style.borderColor = 'hsl(38 92% 55% / 0.15)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Aggregate badge */}
        {totalBadge > 0 && (
          <div
            className="absolute top-2 right-2 z-10 min-w-[18px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-0.5 shadow-lg"
            style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 7%)' }}
          >
            {totalBadge > 99 ? '99+' : totalBadge}
          </div>
        )}
        <FolderThumbnail apps={folder.apps} />
      </div>
      {/* Label */}
      <span
        className="text-[10px] text-center font-medium mt-1.5"
        style={{
          fontFamily: 'var(--font-sans)',
          color: 'hsl(38 92% 55% / 0.7)',
          letterSpacing: '0.03em',
          lineHeight: '1.2',
        }}
      >
        {folder.name}
      </span>
    </button>
  );
}

// ── Folder overlay ────────────────────────────────────────────────────────────
function FolderOverlay({ folder, badges, tilt, onClose, onNavigate }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        style={{
          background: 'rgba(14,20,36,0.65)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(245,158,11,0.35)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'hsl(38 92% 55%)' }}
            >
              {folder.emoji} {folder.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(38 92% 55% / 0.5)' }}>{folder.apps.length} apps</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Gold divider */}
        <div className="h-px mb-5" style={{ background: 'linear-gradient(90deg, transparent, hsl(38 92% 50% / 0.4), transparent)' }} />

        {/* App grid */}
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-3 gap-y-5">
          {folder.apps.map(app => (
            <FolderAppIcon
              key={app.label}
              app={app}
              badges={badges}
              tilt={tilt}
              onNavigate={onNavigate}
            />
          ))}
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
      {/* Folder grid - responsive command center layout - COMPACT */}
      <div
        className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4"
        style={{
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