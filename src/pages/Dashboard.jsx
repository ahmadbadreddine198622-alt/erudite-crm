import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Search, Users, Bell, MessageCircle, TrendingUp, Building2, UserCheck, LogOut, Settings, Shield, Mail, FileText, BarChart3, ChevronDown, UserCircle, Camera } from 'lucide-react';
import { ALL_APPS, MIN_ITEMS, MAX_ITEMS } from '@/lib/navApps';
import AppPickerSheet from '@/components/ui/AppPickerSheet';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import AppFolderGrid from '@/components/dashboard/AppFolderGrid';
import AIInsightsDashboard from '@/components/shared/AIInsightsDashboard';
import ActivityFeed from '@/components/shared/ActivityFeed';
import PerformanceStreaks from '@/components/shared/PerformanceStreaks';
import ClaudePresenceIcon from '@/components/ui/ClaudePresenceIcon';
import PFListingsGrid from '@/components/properties/PFListingsGrid';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import { Brain } from 'lucide-react';
import FormADashboardWidget from '@/components/dashboard/FormADashboardWidget';
import EvaluationPanel from '@/components/dashboard/EvaluationPanel';
import PipelineStrip from '@/components/dashboard/PipelineStrip';
import PhotographyDashboardWidget from '@/components/dashboard/PhotographyDashboardWidget';
import DocumentsDashboardWidget from '@/components/dashboard/DocumentsDashboardWidget';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const storageKey = (email) => `dashboard_apps_${email || 'default'}`;
const LONG_PRESS_MS = 4000;
const HOLD_CUE_MS = 2000;

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [logoUrl] = useState(() => localStorage.getItem('erudite_logo') || '');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [userPosition, setUserPosition] = useState('');
  const [userProfileImage, setUserProfileImage] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [holdingPath, setHoldingPath] = useState(null);
  const [holdCueActive, setHoldCueActive] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pressTimer = useRef(null);
  const cueTimer = useRef(null);
  const menuRef = useRef(null);

  // Load user
  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) setUserEmail(u.email);
      if (u?.full_name) setUserName(u.full_name);
      if (u?.role) setUserRole(u.role);
      if (u?.position) setUserPosition(u.position);
      if (u?.profile_image) setUserProfileImage(u.profile_image);
    }).catch(() => {});
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Pointer / orientation tracking for tilt specular
  useEffect(() => {
    if (prefersReducedMotion) return;
    let rafId;
    const handlePointer = (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        setTilt({ x: nx, y: ny });
      });
    };
    const handleOrientation = (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setTilt({
          x: Math.max(-1, Math.min(1, (e.gamma || 0) / 30)),
          y: Math.max(-1, Math.min(1, (e.beta  || 0) / 40 - 0.3)),
        });
      });
    };
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('deviceorientation', handleOrientation);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const startPress = useCallback((path) => {
    setHoldingPath(path);
    cueTimer.current = setTimeout(() => setHoldCueActive(true), HOLD_CUE_MS);
    pressTimer.current = setTimeout(() => {
      setEditMode(true);
      setHoldingPath(null);
      setHoldCueActive(false);
    }, LONG_PRESS_MS);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (cueTimer.current) clearTimeout(cueTimer.current);
    setHoldingPath(null);
    setHoldCueActive(false);
  }, []);

  const [apps, setApps] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey(''));
      if (saved) {
        const labels = JSON.parse(saved);
        const resolved = labels.map(l => ALL_APPS.find(a => a.label === l)).filter(Boolean);
        if (resolved.length >= MIN_ITEMS) return resolved;
      }
    } catch {}
    return ALL_APPS;
  });

  // Reload when we get user email
  useEffect(() => {
    if (!userEmail) return;
    try {
      const saved = localStorage.getItem(storageKey(userEmail));
      if (saved) {
        const labels = JSON.parse(saved);
        const resolved = labels.map(l => ALL_APPS.find(a => a.label === l)).filter(Boolean);
        if (resolved.length >= MIN_ITEMS) setApps(resolved);
      }
    } catch {}
  }, [userEmail]);

  const saveOrder = (newApps) => {
    setApps(newApps);
    localStorage.setItem(storageKey(userEmail), JSON.stringify(newApps.map(a => a.label)));
  };

  const removeApp = (path) => {
    if (apps.length <= MIN_ITEMS) return;
    saveOrder(apps.filter(a => a.path !== path));
  };

  const addApp = (app) => {
    if (apps.length >= MAX_ITEMS) return;
    saveOrder([...apps, app]);
    setShowPicker(false);
  };

  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    const next = [...apps];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    saveOrder(next);
  };

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders-pending'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 50),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa-conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 50),
  });

  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => base44.functions.invoke('getDashboardSummary', {}),
    refetchInterval: 30000,
  });
  
  const { data: formAData } = useQuery({
    queryKey: ['form-a-contracts'],
    queryFn: () => base44.functions.invoke('getFormAContracts', {}),
    refetchInterval: 60000,
  });

  const { data: photoData } = useQuery({
    queryKey: ['photography-dashboard'],
    queryFn: () => base44.functions.invoke('getPhotographyDashboardSummary', {}),
    refetchInterval: 60000,
  });

  const { data: docsData } = useQuery({
    queryKey: ['documents-dashboard'],
    queryFn: () => base44.functions.invoke('getDocumentsDashboardSummary', {}),
    refetchInterval: 60000,
  });

  const phaseCounts = dashboardData?.phaseCounts || {};
  const landlordsWithQuals = dashboardData?.landlordsWithQualifications || [];
  const formAWithLandlords = formAData?.contracts || [];
  const activityStats = dashboardData?.activityStats || {};
  const quickStats = dashboardData?.quickStats || {};
  
  console.log('[Dashboard] Form A contracts:', formAWithLandlords?.length);

  const photoStageCounts = photoData?.stageCounts || {};
  const docsStatusCounts = docsData?.statusCounts || {};

  const badges = {
    leads: quickStats.activeLeads || leads.filter(l => l.status === 'active').length,
    reminders: quickStats.pendingReminders || reminders.length,
    whatsapp: quickStats.unreadWhatsApp || conversations.reduce((s, c) => s + (c.unread_count || 0), 0),
  };
  
  // Management intelligence
  const hotLeads = quickStats.hotLeads || leads.filter(l => (l.ai_lead_score || 0) >= 75).length;

  // Search across ALL apps (folder mode — the custom `apps` state is no longer the display grid)
  const filtered = search.trim()
    ? ALL_APPS.filter(a => a.label.toLowerCase().includes(search.toLowerCase()))
    : ALL_APPS;

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6 pb-8 pt-20"
      style={{
        background: 'radial-gradient(ellipse at 20% 20%, #1a2a4a 0%, #0F1419 45%, #121821 100%)',
      }}
    >
      {/* Logo */}
      {logoUrl && (
        <div className="mb-6">
          <img src={logoUrl} alt="Erudite" className="h-12 object-contain" />
        </div>
      )}

      {/* Logged-in account badge with dropdown menu */}
      {userEmail && (
        <div className="absolute top-4 right-4 z-50" ref={menuRef}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105"
            style={{
              background: showUserMenu ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
              border: showUserMenu ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(12px)',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
              style={{ background: userProfileImage ? 'transparent' : 'hsl(38 92% 50% / 0.25)', color: 'hsl(38 92% 55%)' }}
            >
              {userProfileImage ? (
                <img src={userProfileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (userName || userEmail)[0].toUpperCase()
              )}
            </div>
            <div className="flex flex-col items-start gap-0">
              <span style={{ color: 'hsl(38 92% 55%)' }} className="font-semibold">{userName || userEmail}</span>
              {userPosition && <span className="text-[9px] uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)', opacity: 0.7 }}>{userPosition}</span>}
            </div>
            <ChevronDown className={`w-3 h-3 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} style={{ color: 'hsl(38 92% 55%)' }} />
          </div>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(15,20,30,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(245,158,11,0.35)',
              }}
            >
              <div className="p-3 border-b border-white/10">
                <p className="text-sm font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>{userName || 'User'}</p>
                <p className="text-xs text-white/50">{userEmail}</p>
                {userRole && (
                  <div className="mt-1.5">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'hsl(38 92% 50% / 0.15)', color: 'hsl(38 92% 55%)', border: '1px solid hsl(38 92% 50% / 0.3)' }}>
                      {userRole}
                    </span>
                  </div>
                )}
              </div>
              <div className="py-2">
                <button
                  onClick={() => { navigate('/team'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Users className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Team Management</span>
                </button>
                <button
                  onClick={() => { navigate('/landlords'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Building2 className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Landlord Pipeline</span>
                </button>
                <button
                  onClick={() => { navigate('/leads'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <UserCheck className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Assign Leads</span>
                </button>
                <button
                  onClick={() => { navigate('/analytics'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Analytics</span>
                </button>
                <button
                  onClick={() => { navigate('/finance'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <FileText className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Finance</span>
                </button>
                <button
                  onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Profile Settings</span>
                </button>
              </div>
              <div className="py-2 border-t border-white/10">
                <button
                  onClick={() => base44.auth.logout()}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" style={{ color: 'rgba(255,100,100,0.8)' }} />
                  <span style={{ color: 'rgba(255,100,100,0.8)' }}>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Row — compact single row of 4 */}
      <div
        className="grid grid-cols-4 w-full max-w-4xl"
        style={{ gap: 10, marginBottom: 26 }}
      >
        {/* Active Leads */}
        <button
          onClick={() => navigate('/leads')}
          className="flex flex-col items-center justify-center py-3 px-2 transition-all active:scale-[0.96]"
          style={{ borderRadius: 18, background: 'linear-gradient(160deg,#141b29,#101622)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-center mb-2" style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(232,163,61,0.15)', border: '1px solid rgba(232,163,61,0.2)' }}>
            <Users className="w-4 h-4" style={{ color: '#e8a33d' }} />
          </div>
          <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#e8a33d', lineHeight: 1 }}>{badges.leads}</p>
          <p className="uppercase font-semibold mt-1" style={{ fontSize: 9.5, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)' }}>ACTIVE</p>
        </button>

        {/* Reminders */}
        <button
          onClick={() => navigate('/reminders')}
          className="flex flex-col items-center justify-center py-3 px-2 transition-all active:scale-[0.96]"
          style={{ borderRadius: 18, background: 'linear-gradient(160deg,#141b29,#101622)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-center mb-2" style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(232,163,61,0.15)', border: '1px solid rgba(232,163,61,0.2)' }}>
            <Bell className="w-4 h-4" style={{ color: '#e8a33d' }} />
          </div>
          <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#e8a33d', lineHeight: 1 }}>{badges.reminders}</p>
          <p className="uppercase font-semibold mt-1" style={{ fontSize: 9.5, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)' }}>REMINDERS</p>
        </button>

        {/* Unread */}
        <button
          onClick={() => navigate('/whatsapp')}
          className="flex flex-col items-center justify-center py-3 px-2 transition-all active:scale-[0.96]"
          style={{ borderRadius: 18, background: 'linear-gradient(160deg,#141b29,#101622)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-center mb-2" style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(91,155,255,0.15)', border: '1px solid rgba(91,155,255,0.2)' }}>
            <MessageCircle className="w-4 h-4" style={{ color: '#5b9bff' }} />
          </div>
          <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)', lineHeight: 1 }}>{badges.whatsapp}</p>
          <p className="uppercase font-semibold mt-1" style={{ fontSize: 9.5, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)' }}>UNREAD</p>
        </button>

        {/* Hot Leads */}
        <button
          onClick={() => navigate('/leads')}
          className="flex flex-col items-center justify-center py-3 px-2 transition-all active:scale-[0.96]"
          style={{ borderRadius: 18, background: 'linear-gradient(160deg,#141b29,#101622)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-center mb-2" style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <TrendingUp className="w-4 h-4" style={{ color: '#22c55e' }} />
          </div>
          <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#22c55e', lineHeight: 1 }}>{hotLeads}</p>
          <p className="uppercase font-semibold mt-1" style={{ fontSize: 9.5, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)' }}>HOT</p>
        </button>
      </div>

      {/* Pipeline Summary Strip */}
      {isLoadingDashboard ? (
        <div className="w-full max-w-4xl mb-8 flex justify-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
        </div>
      ) : (
        <PipelineStrip phaseCounts={phaseCounts} />
      )}

      {/* Clock */}
      <div className="text-center" style={{ marginBottom: 22 }}>
        <p style={{ fontSize: 34, fontWeight: 300, color: 'rgba(255,255,255,0.92)', lineHeight: 1 }}>
          {format(new Date(), 'h:mm')}
          <span style={{ fontSize: 16, color: '#e8a33d', marginLeft: 4 }}>{format(new Date(), 'a')}</span>
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#e8a33d', marginTop: 4 }}>{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Done button — only visible in edit mode */}
      {editMode && (
        <button
          onClick={() => setEditMode(false)}
          className="absolute top-6 right-48 z-20 px-4 py-2 rounded-xl text-sm font-semibold bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
        >
          Done
        </button>
      )}

      {/* Search */}
      <div className="relative mb-10 w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search apps"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.95)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'hsl(38 92% 50%)';
            e.target.style.background = 'rgba(255,255,255,0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(255,255,255,0.12)';
            e.target.style.background = 'rgba(255,255,255,0.07)';
          }}
        />
      </div>

      {/* App Grid — folder mode or flat search results */}
      <div className="ios-grid-enter w-full flex flex-col items-center pb-44">
        {search.trim() ? (
          /* Flat search results — show matching apps directly across all folders */
          <div className="w-full max-w-2xl grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-x-4 gap-y-7">
            {filtered.map((app, idx) => {
              const Icon = app.icon;
              const badgeCount = app.badgeKey ? badges[app.badgeKey] : 0;
              return (
                <button
                  key={app.path + app.label}
                  onClick={() => app.href ? window.open(app.href, '_blank') : navigate(app.path)}
                  className="flex flex-col items-center gap-1.5 select-none focus:outline-none transition-transform active:scale-95"
                >
                  <ExtremeLiquidIcon
                    icon={Icon}
                    gradient={app.gradient}
                    glowColor={app.glowColor}
                    tiltX={tilt.x}
                    tiltY={tilt.y}
                    index={idx}
                    isDragging={false}
                    active={false}
                    badge={badgeCount > 0 ? badgeCount : 0}
                  />
                  <span className="text-[11px] text-center leading-tight max-w-[64px] font-medium min-h-[2rem] flex items-start justify-center text-white/75">
                    {app.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Folder grid */
          <AppFolderGrid badges={badges} tilt={tilt} />
        )}
      </div>

      {/* Quick Navigation Buttons */}
      <div className="flex flex-wrap gap-3 justify-center w-full max-w-3xl mt-6 mb-2">
        <button
          onClick={() => {
            console.log('Navigating to Landlord Pipeline');
            navigate('/landlords');
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: 'hsl(38 92% 55%)' }}
        >
          <Building2 className="w-4 h-4" />
          Landlord Pipeline
        </button>
        <button
          onClick={() => {
            console.log('Navigating to Assign Leads');
            navigate('/landlords');
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
        >
          <UserCheck className="w-4 h-4" />
          Assign Leads
        </button>
        <button
          onClick={() => {
            window.open('https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264', '_blank', 'noopener,noreferrer');
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
        >
          <UserCircle className="w-4 h-4" />
          PF Agent Profile
        </button>
        <button
          onClick={() => navigate('/policies')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}
        >
          <Shield className="w-4 h-4" />
          Policies & HR
        </button>
      </div>

      {/* Property Finder Listings */}
      <EruditeSection title="Property Finder" subtitle="My Active Listings" icon={Building2} className="w-full max-w-5xl mt-8">
        <PFListingsGrid />
      </EruditeSection>

      {/* Evaluation Panel */}
      <EvaluationPanel 
        landlords={landlordsWithQuals} 
        onUploadFormA={() => navigate('/form-a-inbox')} 
      />

      {/* AI Insights + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl mt-8">
        <EruditeSection title="AI Insights" subtitle="Your Intelligence Hub" icon={Brain}>
          <AIInsightsDashboard />
        </EruditeSection>
        <EruditeSection title="Form A Contracts" subtitle="Recent Mandates" icon={FileText}>
          <FormADashboardWidget forms={formAWithLandlords} />
        </EruditeSection>
        <EruditeSection title="Photography" subtitle="Production Pipeline" icon={Camera}>
          <PhotographyDashboardWidget stageCounts={photoStageCounts} totalTasks={photoData?.totalTasks || 0} />
        </EruditeSection>
        <EruditeSection title="Documents" subtitle="Checklist Status" icon={FileText}>
          <DocumentsDashboardWidget 
            statusCounts={docsStatusCounts} 
            typeCounts={docsData?.typeCounts || {}} 
            totalDocs={docsData?.totalDocs || 0}
            completionRate={docsData?.completionRate || 0}
          />
        </EruditeSection>
        <EruditeSection title="Activity" subtitle="Recent Updates" icon={TrendingUp}>
          <ActivityFeed />
        </EruditeSection>
      </div>

      {/* No results */}
      {search.trim() && filtered.length === 0 && (
        <p className="text-white/40 text-sm mt-20">No apps match "{search}"</p>
      )}

      {/* Picker */}
      {showPicker && (
        <AppPickerSheet
          currentItems={apps}
          onAdd={addApp}
          onClose={() => setShowPicker(false)}
          title="Add to Dashboard"
        />
      )}
    </div>
  );
}