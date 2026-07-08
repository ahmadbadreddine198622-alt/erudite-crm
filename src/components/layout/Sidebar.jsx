import React from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import LiquidGlassIcon from '@/components/ui/LiquidGlassIcon';
import EruditeLogo from '@/components/erudite/EruditeLogo';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, ChevronLeft, LogOut, MessageCircle, MessageSquare, Inbox, BarChart3, UserCheck, FileSignature, Brain, Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2, GitMerge, Mail, FolderOpen, Key, Percent, TrendingUp, Crown, User, FileText, Mic, ScrollText, NotebookPen,
  Handshake, Repeat, Eye, FileBox, Megaphone, LineChart, UserSearch, CheckCircle, CheckCircle2, Camera, PhoneCall, Shield, Palette, ReceiptText, ClipboardList, Settings
} from 'lucide-react';

// Jewel hue per workspace section (R,G,B)
const SECTION_HUES = {
  'CEO & Admin': '212,175,55',
  'Leads & Pipeline': '139,92,246',
  'Landlords & Listings': '240,169,59',
  'Deals & Money': '45,212,167',
  'Comms': '61,109,246',
  'Analytics & AI': '34,211,238',
  'Team & HR': '244,114,182',
  'Tools & Reference': '154,166,192',
};

import { cn } from '@/lib/utils';

// permission: which permission key is required (undefined = everyone sees it)
// adminOnly: true = only admin role sees it
const navSections = [
  {
    section: 'CEO & Admin',
    adminOnly: true,
    items: [
      { label: 'Command Center',      icon: LayoutDashboard, path: '/command-center',      gradient: 'from-amber-400 to-yellow-600' },
      { label: 'Company Settings',    icon: Building2,       path: '/company-settings',    gradient: 'from-amber-500 to-orange-700' },
      { label: 'Policies & HR',       icon: Shield,          path: '/policies',            gradient: 'from-indigo-500 to-violet-800' },
      { label: 'Design System',       icon: Palette,         path: '/design-system',       gradient: 'from-fuchsia-500 to-purple-800' },
      { label: 'Team AI OS',          icon: Brain,           path: '/team-os',             gradient: 'from-indigo-500 to-violet-800' },
      { label: 'Team Performance',    icon: Trophy,          path: '/team-performance',    gradient: 'from-emerald-500 to-teal-700' },
      { label: 'Agent Intelligence',  icon: Brain,           path: '/agent-intelligence',  gradient: 'from-violet-500 to-purple-800' },
      { label: 'Team Dashboard',      icon: Trophy,          path: '/team-dashboard',      gradient: 'from-yellow-500 to-amber-700' },
      { label: 'Analytics',           icon: BarChart3,       path: '/analytics',           gradient: 'from-purple-500 to-fuchsia-800' },
      { label: 'Dubai Intelligence',  icon: TrendingUp,      path: '/dubai-intelligence',  gradient: 'from-amber-500 to-orange-700' },
      { label: 'Cheque Register',     icon: ClipboardList,   path: '/cheque-register',     gradient: 'from-emerald-500 to-teal-700' },
    ],
  },
  {
    section: 'Leads & Pipeline',
    items: [
      { label: 'Pipeline',            icon: KanbanSquare,    path: '/pipeline',            gradient: 'from-violet-600 to-purple-800', permission: 'view_all_pipeline' },
      { label: 'Leads',               icon: Users,           path: '/leads',               gradient: 'from-emerald-500 to-emerald-800' },
      { label: 'Contacts',            icon: UserCheck,       path: '/contacts',            gradient: 'from-sky-500 to-cyan-800' },
      { label: 'PF Leads',            icon: Users,           path: '/property-finder-leads', gradient: 'from-rose-500 to-red-700' },
      { label: 'Meta & Google Leads', icon: Zap,             path: '/meta-ads-leads',      gradient: 'from-blue-500 to-sky-700' },
      { label: 'Instagram Leads',     icon: Instagram,       path: '/instagram',           gradient: 'from-fuchsia-500 to-pink-700' },
      { label: 'Buyer Match AI',      icon: UserSearch,      path: '/buyer-match-ai',      gradient: 'from-pink-500 to-rose-700' },
      { label: 'Duplicate Detector',  icon: GitMerge,        path: '/duplicates',          gradient: 'from-orange-500 to-amber-700' },
    ],
  },
  {
    section: 'Landlords & Listings',
    items: [
      { label: 'Flow',                icon: Zap,             path: '/flow',                gradient: 'from-amber-400 to-yellow-600' },
      { label: 'Landlords',           icon: Building2,       path: '/landlords',           gradient: 'from-amber-500 to-orange-700', permission: 'manage_landlords' },
      { label: 'Projects',            icon: FolderOpen,      path: '/projects',            gradient: 'from-teal-500 to-teal-800' },
      { label: 'Property Finder',     icon: Link2,           path: '/property-finder',     gradient: 'from-red-500 to-rose-700' },
      { label: 'Listing Production',  icon: KanbanSquare,    path: '/listing-production',  gradient: 'from-amber-500 to-yellow-600' },
      { label: 'Photography',         icon: Camera,          path: '/photography',         gradient: 'from-rose-500 to-pink-700' },
      { label: 'Matterport Sync',     icon: Camera,          path: '/matterport-sync',     gradient: 'from-amber-500 to-orange-700' },
      { label: 'Property Intel',      icon: Building2,       path: '/property-intel',      gradient: 'from-emerald-500 to-teal-700' },
    ],
  },
  {
    section: 'Deals & Money',
    items: [
      { label: 'Form A Inbox',        icon: FileSignature,   path: '/form-a-inbox',        gradient: 'from-amber-600 to-yellow-700' },
      { label: 'Offers',              icon: FileSignature,   path: '/offers',              gradient: 'from-cyan-500 to-blue-800' },
      { label: 'Negotiations',        icon: Handshake,       path: '/negotiations',        gradient: 'from-amber-500 to-orange-700' },
      { label: 'Closing AI',          icon: CheckCircle,     path: '/closing-ai',          gradient: 'from-green-500 to-emerald-700' },
      { label: 'Closing Hub',         icon: CheckCircle2,    path: '/closing-hub',         gradient: 'from-emerald-500 to-green-700' },
      { label: 'Finance',             icon: Calculator,      path: '/finance',             gradient: 'from-green-500 to-teal-800', permission: 'view_finance' },
      { label: 'Commissions',         icon: DollarSign,      path: '/commissions',         gradient: 'from-amber-400 to-yellow-700', permission: 'view_finance' },
      { label: 'Cheques',             icon: ReceiptText,     path: '/cheques',             gradient: 'from-indigo-500 to-violet-700' },
      { label: 'Key Handover',        icon: Key,             path: '/key-handover',        gradient: 'from-orange-500 to-red-700' },
      { label: 'Transfer Calculator', icon: Percent,         path: '/transfer-calculator', gradient: 'from-amber-500 to-yellow-700' },
      { label: 'Lease Agreement',     icon: FileText,        path: '/lease-agreement',     gradient: 'from-indigo-500 to-slate-700' },
      { label: 'Tenancy Contracts',   icon: ScrollText,      path: '/tenancy-contracts',   gradient: 'from-teal-500 to-cyan-800' },
    ],
  },
  {
    section: 'Comms',
    items: [
      { label: 'Messages',            icon: MessageSquare,   path: '/messages',            gradient: 'from-green-600 to-emerald-800' },
      { label: 'Inbox',               icon: Inbox,           path: '/inbox',               gradient: 'from-blue-600 to-indigo-800' },
      { label: 'WhatsApp Inbox',      icon: MessageCircle,   path: '/whatsapp',            gradient: 'from-green-500 to-green-800', permission: 'view_all_whatsapp' },
      { label: 'WhatsApp Hub',        icon: Zap,             path: '/whatsapp-hub',        gradient: 'from-emerald-500 to-green-700', permission: 'view_all_whatsapp' },
      { label: 'WhatsApp Setup',      icon: MessageCircle,   path: '/whatsapp-setup',      gradient: 'from-slate-500 to-slate-700' },
      { label: 'Broadcasts',          icon: Megaphone,       path: '/broadcasts',          gradient: 'from-purple-500 to-violet-700' },
      { label: 'Email Automations',   icon: Mail,            path: '/email-automations',   gradient: 'from-indigo-500 to-blue-800' },
      { label: 'Template Hub',        icon: FileBox,         path: '/email-templates',     gradient: 'from-sky-500 to-cyan-700' },
      { label: 'Twilio Hub',          icon: PhoneCall,       path: '/twilio',              gradient: 'from-red-500 to-red-800' },
      { label: 'AI Voice',            icon: Mic,             path: '/vapi',                gradient: 'from-violet-500 to-purple-800' },
    ],
  },
  {
    section: 'Analytics & AI',
    items: [
      { label: 'Dashboard',           icon: LayoutDashboard, path: '/',                    gradient: 'from-blue-600 to-blue-800' },
      { label: 'My Dashboard',        icon: UserCircle,      path: '/my-dashboard',        gradient: 'from-blue-500 to-indigo-700' },
      { label: 'My Leads Today',      icon: Users,           path: '/my-leads-today',      gradient: 'from-emerald-500 to-teal-700' },
      { label: 'Market Intelligence', icon: LineChart,       path: '/market-intelligence', gradient: 'from-indigo-500 to-blue-700' },
      { label: 'Claude AI',           icon: Sparkles,        path: '/claude-ai',           gradient: 'from-violet-500 to-purple-800' },
      { label: 'Elite Desk',          icon: Crown,           path: '/elite-desk',          gradient: 'from-amber-500 to-yellow-700' },
      { label: 'Leaderboard',         icon: Trophy,          path: '/leaderboard',         gradient: 'from-yellow-500 to-amber-700' },
    ],
  },
  {
    section: 'Team & HR',
    items: [
      { label: 'Team',                icon: UserCheck,       path: '/team',                gradient: 'from-slate-500 to-slate-700' },
      { label: 'Reminders',           icon: Bell,            path: '/reminders',           gradient: 'from-rose-500 to-red-700' },
    ],
  },
  {
    section: 'Tools & Reference',
    items: [
      { label: 'Smart Notes',         icon: NotebookPen,     path: '/notes',               gradient: 'from-lime-500 to-emerald-700' },
      { label: 'Viewings',            icon: Eye,             path: '/viewings',            gradient: 'from-blue-500 to-indigo-700' },
      { label: 'Follow Ups',          icon: Repeat,          path: '/follow-ups',          gradient: 'from-rose-500 to-pink-700' },
    ],
  },
];

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const { user, isAdmin, isCEO, permissions } = useCurrentUser();
  const logoUrl = typeof window !== 'undefined' ? localStorage.getItem('erudite_logo') : '';
  const userInitial = (user?.full_name || user?.email || '?')[0].toUpperCase();
  const userRoleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
  const isHome = location.pathname === '/';

  // Build visible sections by filtering each item against role/permissions
  const visibleSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (isAdmin || isCEO) return true;
      if (item.adminOnly || section.adminOnly) return false;
      if (item.permission && !permissions[item.permission]) return false;
      return true;
    }),
  })).filter(section => section.items.length > 0);

  return (
    <aside className={cn(
      "fixed top-0 left-0 h-screen flex flex-col z-50 w-[236px] transition-transform duration-300",
      open ? "translate-x-0" : "-translate-x-full"
    )} style={{
      background: 'rgba(255,255,255,0.012)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    }}>
      {/* ── Logo / wordmark ─────────────────────────────────────── */}
      <div className="shrink-0 flex items-center" style={{ padding: '26px 18px 18px', gap: '10px' }}>
        {logoUrl && (
          <img src={logoUrl} alt="Erudite" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
        )}
        <div className="flex flex-col">
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: '15px',
            letterSpacing: '0.26em',
            background: 'linear-gradient(92deg, #eccd72, #d4af37 55%, #b8862b)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1,
          }}>ERUDITE</span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '8px',
            letterSpacing: '0.36em',
            fontWeight: 700,
            color: '#5d6680',
            marginTop: '4px',
          }}>REAL ESTATE · DUBAI</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{ color: '#5d6680' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e8ecf6'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5d6680'; }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Dashboard home item */}
        <Link
          to="/"
          onClick={onClose}
          className="group flex items-center transition-all duration-200 relative"
          style={{
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '11px',
            color: isHome ? '#eccd72' : '#8a93ab',
            background: isHome ? 'rgba(212,175,55,0.10)' : 'transparent',
            border: isHome ? '1px solid rgba(212,175,55,0.26)' : '1px solid transparent',
            boxShadow: isHome ? '0 0 26px -10px rgba(212,175,55,0.7)' : 'none',
          }}
          onMouseEnter={e => { if (!isHome) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e8ecf6'; } }}
          onMouseLeave={e => { if (!isHome) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8a93ab'; } }}
        >
          {isHome && (
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '60%', borderRadius: '2px', background: '#d4af37', boxShadow: '0 0 8px rgba(212,175,55,0.8)' }} />
          )}
          <LayoutDashboard style={{ width: '18px', height: '18px', strokeWidth: 1.6 }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 500 }}>Dashboard</span>
        </Link>

        {visibleSections.map((section) => {
          const hue = SECTION_HUES[section.section] || '154,166,192';
          return (
            <React.Fragment key={section.section}>
              {/* Thin divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 12px' }} />
              {/* Section label */}
              <div style={{
                padding: '4px 12px 2px',
                fontFamily: "'Inter', sans-serif",
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#5d6680',
              }}>{section.section}</div>
              {/* Items */}
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className="group flex items-center transition-all duration-200 relative"
                    style={{
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '11px',
                      color: isActive ? `rgb(${hue})` : '#8a93ab',
                      background: isActive ? `rgba(${hue},0.10)` : 'transparent',
                      border: isActive ? `1px solid rgba(${hue},0.26)` : '1px solid transparent',
                      boxShadow: isActive ? `0 0 26px -10px rgba(${hue},0.7)` : 'none',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e8ecf6'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8a93ab'; } }}
                  >
                    {isActive && (
                      <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '60%', borderRadius: '2px', background: `rgb(${hue})`, boxShadow: `0 0 8px rgba(${hue},0.8)` }} />
                    )}
                    <Icon style={{ width: '18px', height: '18px', strokeWidth: 1.6 }} />
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 500 }}>{item.label}</span>
                  </Link>
                );
              })}
            </React.Fragment>
          );
        })}
      </nav>

      {/* ── Footer — user row + logout ─────────────────────────── */}
      <div className="shrink-0" style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 18px' }}>
        <Link
          to="/profile"
          onClick={onClose}
          className="flex items-center transition-all duration-200"
          style={{ gap: '12px', padding: '4px 0' }}
        >
          {/* Avatar */}
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: user?.profile_image ? 'transparent' : 'linear-gradient(135deg, #eccd72, #b8862b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {user?.profile_image ? (
              <img src={user.profile_image} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#0a0e1a', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>{userInitial}</span>
            )}
          </div>
          {/* Name + role */}
          <div className="flex flex-col min-w-0 flex-1">
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '12.5px',
              color: '#e8ecf6',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{user?.full_name || user?.email || 'User'}</span>
            {userRoleLabel && (
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10.5px', color: '#5d6680' }}>{userRoleLabel}</span>
            )}
          </div>
          {/* Settings gear */}
          <Settings style={{ width: '16px', height: '16px', color: '#5d6680', flexShrink: 0 }} />
        </Link>
        {/* Logout */}
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center w-full transition-all duration-200"
          style={{ gap: '12px', padding: '10px 12px', marginTop: '6px', borderRadius: '11px', color: '#5d6680', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fda4af'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5d6680'; }}
        >
          <LogOut style={{ width: '18px', height: '18px', strokeWidth: 1.6 }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 500 }}>Logout</span>
        </button>
      </div>
    </aside>
  );
}