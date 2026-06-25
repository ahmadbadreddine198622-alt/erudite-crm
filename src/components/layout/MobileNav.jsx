import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Users, Building2, KanbanSquare, FileText, MessageCircle,
  Megaphone, Mail, Phone, Inbox, MessageSquare, Copy, Target,
  Instagram, Search, FileSignature, FileCheck, Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NavLauncherSheet from './NavLauncherSheet';

// 4 category launchers (2 left · center Home · 2 right). Each opens a bottom sheet.
const LAUNCHERS = {
  pipelines: {
    label: 'Pipelines',
    icon: KanbanSquare,
    gradient: 'from-violet-500 to-purple-700',
    title: 'Pipelines & Leads',
    sections: [
      {
        header: 'Pipelines',
        rows: [
          { label: 'Landlord Pipeline', icon: Building2, path: '/landlords' },
          { label: 'Buyer Pipeline', icon: KanbanSquare, path: '/pipeline' },
          { label: 'Property Finder Pipeline', icon: Search, path: '/property-finder-dashboard' },
        ],
      },
      {
        header: 'Incoming Leads',
        rows: [
          { label: 'All Leads', icon: Users, path: '/leads' },
          { label: 'Meta Ads', icon: Megaphone, path: '/meta-ads-leads' },
          { label: 'Instagram', icon: Instagram, path: '/instagram' },
          { label: 'Property Finder', icon: Search, path: '/property-finder-leads' },
          { label: 'Lead Scoring', icon: Target, path: '/lead-scoring' },
        ],
      },
    ],
  },
  forms: {
    label: 'Forms',
    icon: FileText,
    gradient: 'from-amber-400 to-orange-600',
    title: 'Forms',
    sections: [
      {
        rows: [
          { label: 'Form A', icon: FileSignature, path: '/form-a-inbox' },
          { label: 'Form I', icon: FileCheck, path: '/form-i-generator' },
          { label: 'Tenancy Contract', icon: FileText, path: '/tenancy-contracts' },
          { label: 'Lease Agreement', icon: FileText, path: '/lease-agreement' },
          { label: 'Offer', icon: Handshake, path: '/offers' },
        ],
      },
    ],
  },
  comms: {
    label: 'Comms',
    icon: MessageCircle,
    gradient: 'from-emerald-400 to-emerald-600',
    title: 'Comms',
    sections: [
      {
        rows: [
          { label: 'WhatsApp', icon: MessageCircle, path: '/whatsapp' },
          { label: 'Messages', icon: MessageSquare, path: '/messages' },
          { label: 'Inbox', icon: Inbox, path: '/inbox' },
          { label: 'Broadcasts', icon: Megaphone, path: '/broadcasts' },
          { label: 'Email', icon: Mail, path: '/email-templates' },
          { label: 'Calls', icon: Phone, path: '/aircall' },
        ],
      },
    ],
  },
  contacts: {
    label: 'Contacts',
    icon: Users,
    gradient: 'from-sky-400 to-cyan-600',
    title: 'Contacts',
    sections: [
      {
        rows: [
          { label: 'Contacts', icon: Users, path: '/contacts' },
          { label: 'Duplicate Detector', icon: Copy, path: '/duplicates' },
        ],
      },
    ],
  },
};

// All destination paths inside a launcher — used for the amber active state.
function launcherPaths(launcher) {
  return launcher.sections.flatMap((s) => s.rows.map((r) => r.path));
}

function NavIcon({ icon: Icon, gradient, active, label, onClick }) {
  const size = 44;
  const radius = `${Math.round(size * 0.22)}px`;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-2 py-1 active:scale-90 transition-transform duration-150"
    >
      <div style={{ width: size, height: size, borderRadius: radius, position: 'relative' }}>
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-45', gradient)}
          style={{ borderRadius: radius }}
        />
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active ? 'rgba(245, 159, 10, 0.18)' : 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: active ? 'rgba(245, 159, 10, 0.55)' : 'rgba(255, 255, 255, 0.32)',
            boxShadow: active
              ? '0 6px 18px rgba(245, 159, 10, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 5px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 50%)',
            pointerEvents: 'none',
          }}
        />
        <Icon
          className="absolute"
          style={{
            width: Math.round(size * 0.48),
            height: Math.round(size * 0.48),
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: active ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.9)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        />
      </div>
      <span className={cn('text-[9px] font-medium', active ? 'text-amber-500' : 'text-white/60')}>
        {label}
      </span>
    </button>
  );
}

export default function MobileNav() {
  const location = useLocation();
  const [openKey, setOpenKey] = useState(null);

  const isLauncherActive = (launcher) => launcherPaths(launcher).includes(location.pathname);

  const renderLauncher = (key) => {
    const launcher = LAUNCHERS[key];
    return (
      <NavIcon
        icon={launcher.icon}
        gradient={launcher.gradient}
        label={launcher.label}
        active={isLauncherActive(launcher)}
        onClick={() => setOpenKey(key)}
      />
    );
  };

  return (
    <>
      <nav
        className="fixed left-0 right-0 z-[100] md:hidden"
        style={{
          bottom: 60,
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 0,
        }}
      >
        {/* Floating glass dock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 4,
            background: 'rgba(12, 18, 35, 0.88)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            borderRadius: 28,
            border: '1px solid rgba(255,255,255,0.15)',
            borderTopColor: 'rgba(255,255,255,0.28)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
            padding: '10px 12px 12px 12px',
          }}
        >
          {/* Left launchers */}
          {renderLauncher('pipelines')}
          {renderLauncher('forms')}

          {/* Center elevated home button */}
          <div style={{ position: 'relative', bottom: 16, zIndex: 10, marginLeft: 4, marginRight: 4 }}>
            <Link to="/">
              <div
                className="active:scale-90 transition-transform duration-150 flex items-center justify-center"
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '22%',
                  background: 'rgba(245, 159, 10, 0.15)',
                  backdropFilter: 'blur(32px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                  border: '2px solid rgba(245, 159, 10, 0.5)',
                  borderTopColor: 'rgba(255,255,255,0.5)',
                  boxShadow: '0 12px 36px rgba(245,159,10,0.45), inset 0 1px 0 rgba(255,255,255,0.28), 0 0 24px rgba(245,159,10,0.2)',
                  animation: 'breathe 3s ease-in-out infinite',
                  position: 'relative',
                }}
              >
                <div
                  className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-700 opacity-35"
                  style={{ borderRadius: '22%' }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    borderRadius: '22%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 55%)',
                    pointerEvents: 'none',
                  }}
                />
                <Home
                  className="relative z-10"
                  style={{
                    width: 26,
                    height: 26,
                    color: 'hsl(38 92% 50%)',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                  }}
                />
              </div>
            </Link>
          </div>

          {/* Right launchers */}
          {renderLauncher('comms')}
          {renderLauncher('contacts')}
        </div>
      </nav>

      {/* Shared bottom sheet for whichever launcher is open */}
      <NavLauncherSheet
        open={!!openKey}
        onClose={() => setOpenKey(null)}
        title={openKey ? LAUNCHERS[openKey].title : ''}
        sections={openKey ? LAUNCHERS[openKey].sections : []}
      />
    </>
  );
}