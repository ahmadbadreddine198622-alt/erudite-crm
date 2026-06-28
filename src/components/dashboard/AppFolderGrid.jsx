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
    subtitle: 'Command & oversight',
    appLabels: ['Company Settings', 'Brand Settings', 'Team Management', 'Analytics', 'Finance', 'Policies & HR', 'Design System', 'Team AI OS', 'Team Performance', 'Agent Intelligence', 'Team Dashboard', 'Dubai Intelligence', 'Cheque Register', 'Command Center'],
  },
  {
    id: 'leads',
    name: 'Leads & Pipeline',
    icon: Target,
    jewelColor: '#c4b1ff',
    jewelAura: 'rgba(139,92,246,.62)',
    liveBadgeKey: 'leads',
    subtitle: 'Track & convert',
    appLabels: ['Pipeline', 'Leads', 'PF Leads', 'Instagram Leads', 'Meta & Google', 'Duplicate Detector', 'Contacts'],
  },
  {
    id: 'landlords',
    name: 'Landlords & Listings',
    icon: Building2,
    jewelColor: '#f5c878',
    jewelAura: 'rgba(240,169,59,.58)',
    subtitle: 'Inventory & owners',
    appLabels: ['Landlords', 'Listing Production', 'Photography', 'Matterport Sync', 'Property Finder', 'Find Property', 'Property Intel', 'Form A Referral', 'Form I Generator'],
  },
  {
    id: 'deals',
    name: 'Deals & Money',
    icon: DollarSign,
    jewelColor: '#7ce8c4',
    jewelAura: 'rgba(45,212,167,.58)',
    liveBadgeKey: 'deals',
    subtitle: 'Close & collect',
    appLabels: ['Closing', 'Closing AI', 'Finance', 'Commissions', 'Cheques', 'Offers', 'Negotiations', 'Deal Risk', 'Transfer Calculator', 'Transfer Numbers', 'Key Handover'],
  },
  {
    id: 'comms',
    name: 'Comms',
    icon: MessageCircle,
    jewelColor: '#9bb9ff',
    jewelAura: 'rgba(61,109,246,.58)',
    liveBadgeKey: 'whatsapp',
    subtitle: 'Inbox & outreach',
    appLabels: ['WhatsApp', 'WhatsApp Hub', 'WhatsApp Setup', 'Messages', 'Broadcasts', 'Email Templates', 'Email Automations', 'Inbox', 'Twilio Hub'],
  },
  {
    id: 'analytics',
    name: 'Analytics & AI',
    icon: Brain,
    jewelColor: '#7fe6f5',
    jewelAura: 'rgba(34,211,238,.58)',
    subtitle: 'Insights & models',
    appLabels: ['Analytics', 'Sales Analytics', 'Team Performance', 'Market Intelligence', 'Buyer Match AI', 'Claude AI', 'Team AI OS', 'Dubai Intelligence', 'Command Center'],
  },
  {
    id: 'team',
    name: 'Team & HR',
    icon: Users,
    jewelColor: '#f7a9d0',
    jewelAura: 'rgba(244,114,182,.55)',
    subtitle: 'People & roles',
    appLabels: ['Team', 'Team Management', 'Policies & HR', 'PF Agent Profile', 'Acknowledgements'],
  },
  {
    id: 'tools',
    name: 'Tools & Reference',
    icon: Wrench,
    jewelColor: '#c3ccdd',
    jewelAura: 'rgba(154,166,192,.45)',
    subtitle: 'Utilities & docs',
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
        width: '72px',
        height: '72px',
        borderRadius: '18px',
        background: `radial-gradient(circle at 50% 40%, ${folder.jewelAura} 0%, transparent 75%)`,
        boxShadow: `inset 0 0 20px ${folder.jewelAura}`,
      }}
    >
      {Icon && <Icon style={{ width: 36, height: 36, color: folder.jewelColor, strokeWidth: 1.75 }} />}
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

  // Live count badge per tile (leads, deals, reminders, unread)
  const liveCount = folder.liveBadgeKey ? (badges[folder.liveBadgeKey] || 0) : 0;

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
      {/* Tile — flat dark card with colored icon glow */}
      <div
        className="relative overflow-hidden flex flex-col items-center justify-center gap-2.5 p-4 transition-all duration-200"
        style={{
          width: '100%',
          minHeight: '148px',
          background: '#16161c',
          border: '1px solid #2a2a35',
          borderRadius: '14px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.borderColor = '#3a3a48';
          e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${folder.jewelAura}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = '#2a2a35';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Live count badge */}
        {liveCount > 0 && (
          <div
            className="absolute top-2 right-2 z-10 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold px-1.5"
            style={{ background: `${folder.jewelColor}22`, color: folder.jewelColor, border: `1px solid ${folder.jewelColor}55` }}
          >
            {liveCount > 99 ? '99+' : liveCount}
          </div>
        )}
        <IconCase folder={folder} />
      </div>
      {/* Title */}
      <span
        className="text-xs text-center font-semibold mt-1.5 block"
        style={{
          color: '#ffffff',
          lineHeight: '1.2',
        }}
      >
        {folder.name}
      </span>
      {/* Subtitle */}
      {folder.subtitle && (
        <span
          className="text-[10px] text-center block mt-0.5"
          style={{
            color: '#666677',
            lineHeight: '1.3',
          }}
        >
          {folder.subtitle}
        </span>
      )}
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
              {folder.name}
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

  // Direct route for each workspace tile (first app in the folder, or a custom route)
  const TILE_ROUTES = {
    ceo: '/company-settings',
    leads: '/leads',
    landlords: '/landlords',
    deals: '/closing',
    comms: '/messages',
    analytics: '/analytics',
    team: '/team',
    tools: '/reminders',
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
            onOpen={(fid) => {
              const route = TILE_ROUTES[fid];
              if (route) navigate(route);
              else setOpenFolder(fid);
            }}
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