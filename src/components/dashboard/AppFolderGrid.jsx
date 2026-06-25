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
        gap: '16px',
        padding: '16px',
        width: '160px',
        height: '160px',
        borderRadius: '24px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxSizing: 'border-box',
        WebkitBoxSizing: 'border-box',
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => {
        const app = preview[i];
        if (!app) return (
          <div key={i} style={{ borderRadius: '16px', background: 'rgba(255,255,255,0.05)' }} />
        );
        const Icon = app.icon;
        // Parse gradient colors for Safari-compatible inline styles
        const getGradient = (gradient) => {
          if (!gradient) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
          // Handle Tailwind-like gradients: from-purple-500 to-pink-500
          const colorMap = {
            'purple-500': '#a855f7', 'purple-600': '#9333ea',
            'pink-500': '#ec4899', 'pink-600': '#db2777',
            'blue-500': '#3b82f6', 'blue-600': '#2563eb',
            'green-500': '#22c55e', 'green-600': '#16a34a',
            'orange-500': '#f97316', 'orange-600': '#ea580c',
            'red-500': '#ef4444', 'red-600': '#dc2626',
            'slate-600': '#475569', 'slate-800': '#1e293b',
            'indigo-500': '#6366f1', 'indigo-600': '#4f46e5',
            'cyan-500': '#06b6d4', 'cyan-600': '#0891b2',
            'rose-500': '#f43f5e', 'rose-600': '#e11d48',
            'amber-500': '#f59e0b', 'amber-600': '#d97706',
            'emerald-500': '#10b981', 'emerald-600': '#059669',
          };
          const match = gradient.match(/from-(\w+-\d+)\s+to-(\w+-\d+)/);
          if (match) {
            const from = colorMap[match[1]] || '#667eea';
            const to = colorMap[match[2]] || '#764ba2';
            return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
          }
          return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        };
        return (
          <div
            key={app.label}
            style={{
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              background: getGradient(app.gradient),
            }}
          >
            {/* Use a simple coloured square with the icon — lightweight vs full ExtremeLiquidIcon */}
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {Icon ? (
                <Icon style={{ width: '28px', height: '28px', color: 'rgba(255,255,255,0.95)', strokeWidth: 1.8 }} />
              ) : (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>?</span>
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        transform: 'scale(1)',
        transition: 'transform 0.15s ease',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
      className="group active:scale-95 focus:outline-none"
    >
      {/* Tile */}
      <div
        style={{
          position: 'relative',
          borderRadius: '24px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          width: '180px',
          minHeight: '180px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.14)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'border-color 0.2s ease',
        }}
        className="group-hover:border-amber-500/40"
      >
        {/* Aggregate badge */}
        {totalBadge > 0 && (
          <div
            className="absolute -top-2 -right-2 z-10 min-w-[24px] h-6 rounded-full flex items-center justify-center text-[11px] font-bold px-1.5 shadow-lg"
            style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 7%)' }}
          >
            {totalBadge > 99 ? '99+' : totalBadge}
          </div>
        )}
        <FolderThumbnail apps={folder.apps} />
      </div>
      {/* Label */}
      <span
        className="text-[13px] text-center leading-tight max-w-[140px] font-semibold text-white/80"
        style={{ fontFamily: 'var(--font-sans)' }}
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
      {/* Folder grid */}
      <div
        style={{
          width: '100%',
          maxWidth: '896px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '32px',
          justifyItems: 'center',
          margin: '0 auto',
          boxSizing: 'border-box',
          WebkitBoxSizing: 'border-box',
        }}
        className="sm:grid-cols-4"
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