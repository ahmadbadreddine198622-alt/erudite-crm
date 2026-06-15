import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import { ALL_APPS } from '@/lib/navApps';

// ── Folder definitions ────────────────────────────────────────────────────────
// Maps exact app labels to folders. Apps not listed fall into Tools & Reference.
const FOLDER_DEFS = [
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
      className="grid grid-cols-2 gap-1 p-1.5 rounded-2xl"
      style={{
        width: 72, height: 72,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => {
        const app = preview[i];
        if (!app) return (
          <div key={i} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />
        );
        const Icon = app.icon;
        return (
          <div
            key={app.label}
            className="rounded-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--tw-gradient-from, #333), var(--tw-gradient-to, #111))`,
              backgroundImage: `linear-gradient(135deg, ${app.gradient?.includes('from-') ? '' : ''})`,
            }}
          >
            {/* Use a simple coloured square with the icon — lightweight vs full ExtremeLiquidIcon */}
            <div
              className={`w-full h-full rounded-lg flex items-center justify-center bg-gradient-to-br ${app.gradient || 'from-slate-600 to-slate-800'}`}
            >
              {Icon ? (
                <Icon className="w-3.5 h-3.5 text-white/90" strokeWidth={1.8} />
              ) : (
                <span className="text-[8px] text-white/30">?</span>
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
        className="flex flex-col items-center gap-1.5 select-none focus:outline-none transition-transform active:scale-95"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-slate-600 to-slate-800 border border-white/10"
        >
          <span className="text-xs text-white/40">?</span>
        </div>
        <span className="text-[11px] text-center leading-tight max-w-[64px] font-medium text-white/75 min-h-[2rem] flex items-start justify-center">
          {app.label}
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={() => onNavigate(app)}
      className="flex flex-col items-center gap-1.5 select-none focus:outline-none transition-transform active:scale-95"
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
      />
      <span className="text-[11px] text-center leading-tight max-w-[64px] font-medium text-white/75 min-h-[2rem] flex items-start justify-center">
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
      className="flex flex-col items-center gap-2 select-none focus:outline-none transition-transform active:scale-95 group"
    >
      {/* Tile */}
      <div
        className="relative rounded-2xl p-2 flex flex-col items-center justify-center gap-2 transition-all group-hover:border-amber-500/40"
        style={{
          width: 96,
          minHeight: 96,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Aggregate badge */}
        {totalBadge > 0 && (
          <div
            className="absolute -top-1.5 -right-1.5 z-10 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold px-1"
            style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 7%)' }}
          >
            {totalBadge > 99 ? '99+' : totalBadge}
          </div>
        )}
        <FolderThumbnail apps={folder.apps} />
      </div>
      {/* Label */}
      <span
        className="text-[11px] text-center leading-tight max-w-[96px] font-medium text-white/75"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {folder.name}
      </span>
    </button>
  );
}

// ── Folder overlay ────────────────────────────────────────────────────────────
function FolderOverlay({ folder, badges, tilt, onClose, onNavigate }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        style={{
          background: 'rgba(14,20,36,0.97)',
          border: '1px solid rgba(245,158,11,0.3)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
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
            <p className="text-xs text-white/40 mt-0.5">{folder.apps.length} apps</p>
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
    </div>
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
      {/* Folder grid */}
      <div className="w-full max-w-2xl grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-6 justify-items-center">
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