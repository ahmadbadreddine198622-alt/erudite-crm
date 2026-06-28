import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Users, Building2, KanbanSquare, FileText, MessageCircle,
  Megaphone, Mail, Phone, Inbox, MessageSquare, Copy, Target,
  Instagram, Search, FileSignature, FileCheck, Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NavLauncherSheet from './NavLauncherSheet';

// ── Per-launcher lit-case hue data ────────────────────────────────────────────
const HUES = {
  pipelines: { lit:'#2e2154', deep:'#1a1338', darkest:'#0e081c', rgb:'139,92,246', icon:'#c4b5fd' },
  forms:     { lit:'#4a3413', deep:'#2a1d0a', darkest:'#170f05', rgb:'240,169,59', icon:'#f5c878' },
  comms:     { lit:'#103a2c', deep:'#0a2419', darkest:'#05130e', rgb:'45,212,167', icon:'#7ce8c4' },
  contacts:  { lit:'#16304f', deep:'#0c1c30', darkest:'#070f1d', rgb:'61,109,246', icon:'#9bb9ff' },
};

// 4 category launchers (2 left · center Home · 2 right). Each opens a bottom sheet.
const LAUNCHERS = {
  pipelines: {
    label: 'Pipelines',
    icon: KanbanSquare,
    hueKey: 'pipelines',
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
    hueKey: 'forms',
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
    hueKey: 'comms',
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
    hueKey: 'contacts',
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

// ── Lit display case dock button ───────────────────────────────────────────────
function NavIcon({ icon: Icon, hue, active, label, onClick }) {
  const size = 52;
  const radius = 16;
  const h = hue;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <div
        style={{
          width: size, height: size, borderRadius: radius,
          position: 'relative', overflow: 'hidden',
          background: `radial-gradient(130% 130% at 30% 18%, ${h.lit}, ${h.deep} 70%, ${h.darkest})`,
          border: '1px solid rgba(212,175,55,0.30)',
          boxShadow: `0 0 24px -8px rgba(${h.rgb},0.6), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1px rgba(212,175,55,0.06)`,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
          e.currentTarget.style.boxShadow = `0 0 48px -6px rgba(${h.rgb},0.85), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 0 0 1px rgba(212,175,55,0.1)`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = `0 0 24px -8px rgba(${h.rgb},0.6), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1px rgba(212,175,55,0.06)`;
        }}
      >
        {/* Top glint — 1px line near top */}
        <div style={{
          position: 'absolute', top: 0, left: '11px', right: '11px', height: '1px',
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.85),transparent)',
          pointerEvents: 'none',
        }} />
        {/* Inner top-glow */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
          background: 'radial-gradient(80% 50% at 50% -10%, rgba(255,255,255,0.22), transparent 70%)',
        }} />
        {/* Icon */}
        <Icon
          className="absolute"
          style={{
            width: 23, height: 23,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: h.icon,
            strokeWidth: 1.7,
            filter: `drop-shadow(0 1px 3px rgba(${h.rgb},0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))`,
          }}
        />
      </div>
      {/* Active dot */}
      <div style={{
        width: active ? 5 : 0, height: active ? 5 : 0,
        borderRadius: '50%', background: `rgb(${h.rgb})`,
        boxShadow: active ? `0 0 8px rgba(${h.rgb},0.6)` : 'none',
        transition: 'all 0.2s ease',
      }} />
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
        hue={HUES[launcher.hueKey]}
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
          bottom: 40,
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {/* Floating glass dock — lit display case tray */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 14,
            background: 'rgba(16,20,32,0.72)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            borderRadius: 26,
            border: '1px solid rgba(212,175,55,0.16)',
            boxShadow: '0 36px 80px -36px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
            padding: '14px 18px',
            position: 'relative',
          }}
        >
          {/* Gold hairline across top edge */}
          <div style={{
            position: 'absolute', top: 0, left: '24px', right: '24px', height: '1px',
            background: 'linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent)',
            pointerEvents: 'none',
          }} />

          {/* Left launchers */}
          {renderLauncher('pipelines')}
          {renderLauncher('forms')}

          {/* Center elevated gold home button */}
          <div style={{ position: 'relative', marginTop: '-12px', zIndex: 10 }}>
            <Link to="/">
              <div
                className="active:scale-90 transition-transform duration-150"
                style={{
                  width: 62, height: 62, borderRadius: 19,
                  position: 'relative', overflow: 'hidden',
                  background: 'radial-gradient(130% 130% at 30% 18%, #5a4618, #2e2208 70%, #171005)',
                  border: '1px solid rgba(212,175,55,0.40)',
                  boxShadow: '0 0 36px -6px rgba(212,175,55,0.7), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 0 0 1px rgba(212,175,55,0.08)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 0 56px -4px rgba(212,175,55,0.9), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 1px rgba(212,175,55,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 36px -6px rgba(212,175,55,0.7), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 0 0 1px rgba(212,175,55,0.08)';
                }}
              >
                {/* Top glint — brightest cream */}
                <div style={{
                  position: 'absolute', top: 0, left: '11px', right: '11px', height: '1px',
                  background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)',
                  pointerEvents: 'none',
                }} />
                {/* Inner top-glow */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 19, pointerEvents: 'none',
                  background: 'radial-gradient(80% 50% at 50% -10%, rgba(255,255,255,0.28), transparent 70%)',
                }} />
                <Home
                  className="absolute"
                  style={{
                    width: 28, height: 28,
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#eccd72',
                    strokeWidth: 1.7,
                    filter: 'drop-shadow(0 1px 4px rgba(212,175,55,0.6)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
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