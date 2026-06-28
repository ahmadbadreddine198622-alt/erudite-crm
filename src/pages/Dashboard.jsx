import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

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
import AudioWaveform from '@/components/shared/AudioWaveform';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeHeroBanner from '@/components/erudite/EruditeHeroBanner';
import IOSLockScreenClock from '@/components/dashboard/IOSLockScreenClock';
import { Brain, Zap } from 'lucide-react';
import FormADashboardWidget from '@/components/dashboard/FormADashboardWidget';
import EvaluationPanel from '@/components/dashboard/EvaluationPanel';
import { QUOTES } from '@/components/dashboard/MotivationalQuote';
import PipelineStrip from '@/components/dashboard/PipelineStrip';
import PhotographyDashboardWidget from '@/components/dashboard/PhotographyDashboardWidget';
import DocumentsDashboardWidget from '@/components/dashboard/DocumentsDashboardWidget';
import DashboardBackground from '@/components/dashboard/DashboardBackground';
import DashboardTopBar from '@/components/dashboard/DashboardTopBar';
import { usePFSyncHealth } from '@/components/propertyfinder/usePFSyncHealth';
import { formatDistanceToNow } from 'date-fns';

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
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const pressTimer = useRef(null);
  const cueTimer = useRef(null);
  const menuRef = useRef(null);
  const dashboardRef = useRef(null);

  // Rotate quotes every 30 seconds for continuous motivation
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
    // Device orientation - iOS Safari requires permission and can cause issues
    const handleOrientation = (e) => {
      try {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setTilt({
            x: Math.max(-1, Math.min(1, (e.gamma || 0) / 30)),
            y: Math.max(-1, Math.min(1, (e.beta  || 0) / 40 - 0.3)),
          });
        });
      } catch (err) {
        console.warn('[Dashboard] Orientation error:', err);
      }
    };
    window.addEventListener('pointermove', handlePointer, { passive: true });
    // Only add orientation listener if not on iOS (requires permission on iOS 13+)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }
    return () => {
      window.removeEventListener('pointermove', handlePointer);
      if (!isIOS) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
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

  const { data: leads = [], error: leadsError } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
    retry: 2,
    staleTime: 5000,
  });

  const { data: reminders = [], error: remindersError } = useQuery({
    queryKey: ['reminders-pending'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 50),
    retry: 2,
    staleTime: 5000,
  });

  const { data: conversations = [], error: conversationsError } = useQuery({
    queryKey: ['wa-conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 50),
    retry: 2,
    staleTime: 5000,
  });

  // Deals for HOT KPI (aurora_temperature hot/blazing OR aurora_score >= 70)
  const { data: allDeals = [] } = useQuery({
    queryKey: ['deals-dashboard'],
    queryFn: () => base44.entities.Deal.list('-created_date', 200),
    retry: 2,
    staleTime: 15000,
  });

  // UNREAD across all 4 message channels
  const { data: unreadWhatsApp = [] } = useQuery({
    queryKey: ['unread-wa-messages'],
    queryFn: () => base44.entities.WhatsAppMessage.filter({ direction: 'inbound', status: 'received' }, '-created_date', 50),
    retry: 1,
    staleTime: 15000,
  });
  const { data: unreadIMessages = [] } = useQuery({
    queryKey: ['unread-imessages'],
    queryFn: () => base44.entities.IMessage.filter({ direction: 'inbound', is_read: false }, '-created_date', 50),
    retry: 1,
    staleTime: 15000,
  });
  const { data: unreadTelegram = [] } = useQuery({
    queryKey: ['unread-telegram'],
    queryFn: () => base44.entities.TelegramMessage.filter({ direction: 'inbound', is_read: false }, '-created_date', 50),
    retry: 1,
    staleTime: 15000,
  });
  const { data: unreadMessages = [] } = useQuery({
    queryKey: ['unread-messages'],
    queryFn: () => base44.entities.Message.filter({ direction: 'inbound', is_read: false }, '-created_date', 50),
    retry: 1,
    staleTime: 15000,
  });

  // PF sync health
  const { data: pfSyncHealth } = usePFSyncHealth();

  const { data: dashboardData, isLoading: isLoadingDashboard, error: dashboardError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => base44.functions.invoke('getDashboardSummary', {}),
    refetchInterval: 30000,
    retry: 2,
    staleTime: 5000,
  });
  
  const { data: formAData, isLoading: isLoadingFormA, error: formAError } = useQuery({
    queryKey: ['form-a-contracts'],
    queryFn: () => base44.functions.invoke('getFormAContracts', {}),
    refetchInterval: 60000,
    staleTime: 0,
    retry: 2,
  });

  const { data: photoData, error: photoError } = useQuery({
    queryKey: ['photography-dashboard'],
    queryFn: () => base44.functions.invoke('getPhotographyDashboardSummary', {}),
    refetchInterval: 60000,
    retry: 2,
    staleTime: 5000,
  });

  const { data: docsData, error: docsError } = useQuery({
    queryKey: ['documents-dashboard'],
    queryFn: () => base44.functions.invoke('getDocumentsDashboardSummary', {}),
    refetchInterval: 60000,
    retry: 2,
    staleTime: 5000,
  });

  // Log errors for debugging
  useEffect(() => {
    const errors = { leads: leadsError, reminders: remindersError, conversations: conversationsError, dashboard: dashboardError, formA: formAError, photo: photoError, docs: docsError };
    const hasError = Object.values(errors).some(e => e);
    if (hasError) {
      console.error('[Dashboard] Query errors:', errors);
    }
  }, [leadsError, remindersError, conversationsError, dashboardError, formAError, photoError, docsError]);

  const phaseCounts = dashboardData?.phaseCounts || {};
  const landlordsWithQuals = dashboardData?.landlordsWithQualifications || [];
  const formAWithLandlords = formAData?.contracts || [];
  const activityStats = dashboardData?.activityStats || {};
  const quickStats = dashboardData?.quickStats || {};
  
  console.log('[Dashboard] Form A contracts:', formAWithLandlords?.length);

  const photoStageCounts = photoData?.stageCounts || {};
  const docsStatusCounts = docsData?.statusCounts || {};

  const activeLeads = leads.filter(l => l.status === 'active');
  const activeLeadCount = activeLeads.length;

  // +N today: leads created today (first_touch_at or created_date)
  const todayStr = new Date().toISOString().slice(0, 10);
  const leadsToday = leads.filter(l => {
    const d = l.first_touch_at || l.created_date;
    return d && String(d).slice(0, 10) === todayStr;
  }).length;

  // Reminders due today (Followup where due_date <= today and not completed)
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const dueTodayFollowups = (dashboardData?.followups || []).filter(f =>
    f.due_date && new Date(f.due_date) <= todayEnd && f.status !== 'completed'
  );
  const remindersDueNow = reminders.filter(r => {
    const d = r.due_date || r.scheduled_at;
    return d && new Date(d) <= new Date();
  });
  const remindersCount = dueTodayFollowups.length || remindersDueNow.length;

  // UNREAD across all 4 message channels
  const totalUnread = unreadWhatsApp.length + unreadIMessages.length + unreadTelegram.length + unreadMessages.length;

  // HOT deals: aurora_temperature hot/blazing OR aurora_score >= 70
  const hotDeals = allDeals.filter(d => {
    const temp = (d.aurora_temperature || '').toLowerCase();
    return temp === 'hot' || temp === 'blazing' || (d.aurora_score || 0) >= 70;
  });
  const blazingCount = allDeals.filter(d => (d.aurora_temperature || '').toLowerCase() === 'blazing').length;

  const badges = {
    leads: activeLeadCount,
    reminders: remindersCount,
    whatsapp: totalUnread,
    deals: hotDeals.length,
  };

  // Search across ALL apps (folder mode — the custom `apps` state is no longer the display grid)
  const filtered = search.trim()
    ? ALL_APPS.filter(a => a.label.toLowerCase().includes(search.toLowerCase()))
    : ALL_APPS;

  return (
    <div
      ref={dashboardRef}
      className="dashboard-skin relative min-h-screen flex flex-col px-4 pb-[140px] pt-4"
    >
      <DashboardBackground />
      <div className="relative w-full max-w-[1320px] mx-auto" style={{ zIndex: 1 }}>
      {/* Top bar — gold ERUDITE wordmark, search, clock, avatar */}
      <DashboardTopBar
        search={search}
        setSearch={setSearch}
        userName={userName}
        userEmail={userEmail}
        userProfileImage={userProfileImage}
      />

      {/* KPI Strip — live counts with gold hairline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-[1320px] mx-auto gap-3 mb-10">
        {[
          { label: 'Active', value: activeLeadCount, icon: Users, sub: `+${leadsToday} today`, subColor: '#7ce8c4', subBg: 'rgba(45,212,167,.16)', onClick: () => navigate('/leads') },
          { label: 'Reminders', value: remindersCount, icon: Bell, sub: remindersDueNow.length > 0 ? `${remindersDueNow.length} due now` : 'none due', subColor: '#f5c878', subBg: 'rgba(240,169,59,.16)', onClick: () => navigate('/reminders') },
          { label: 'Unread', value: totalUnread, icon: MessageCircle, sub: `${unreadWhatsApp.length + unreadMessages.length} new replies`, subColor: '#9bb9ff', subBg: 'rgba(61,109,246,.16)', onClick: () => navigate('/whatsapp') },
          { label: 'Hot', value: hotDeals.length, icon: TrendingUp, sub: hotDeals.length === 0 ? 'none flagged' : (blazingCount > 0 ? `${blazingCount} blazing` : `${hotDeals.length} hot`), subColor: hotDeals.length === 0 ? 'var(--ds-muted-dim, #5d6680)' : 'var(--ds-gold, #d4af37)', subBg: hotDeals.length === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(212,175,55,.16)', onClick: () => navigate('/closing') },
        ].map((kpi, i) => (
          <button
            key={i}
            onClick={kpi.onClick}
            className="relative overflow-hidden flex flex-col items-center gap-1.5 p-3 transition-all hover:-translate-y-[3px]"
            style={{
              background: 'var(--ds-card, rgba(255,255,255,0.022))',
              border: '1px solid var(--ds-card-line, rgba(255,255,255,0.07))',
              borderRadius: '18px',
            }}
          >
            {/* Gold hairline top */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,.5), transparent)',
              marginLeft: '22px',
              marginRight: '22px',
            }} />
            {/* Icon chip */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
              background: 'rgba(212,175,55,.1)',
              border: '1px solid rgba(212,175,55,.2)',
            }}>
              <kpi.icon style={{ width: 14, height: 14, color: 'var(--ds-gold-lite, #eccd72)' }} />
            </div>
            {/* Number */}
            <p style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 600,
              lineHeight: 1,
              color: 'var(--ds-ink, #e8ecf6)',
            }}>{kpi.value}</p>
            {/* Label */}
            <p className="text-[8px] uppercase tracking-widest font-medium" style={{ color: 'var(--ds-muted, #8a93ab)' }}>{kpi.label}</p>
            {/* Sub-chip */}
            <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded-full" style={{
              background: kpi.subBg,
              color: kpi.subColor,
            }}>{kpi.sub}</span>
          </button>
        ))}
      </div>

      {/* WORKSPACES section eyebrow with hairline rule */}
      <div className="w-full max-w-[1320px] mx-auto mb-4 flex items-center gap-3">
        <p className="text-xs uppercase tracking-[0.3em] shrink-0" style={{ color: 'var(--ds-gold-lite, #eccd72)', opacity: 0.7, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
          Workspaces
        </p>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.3), transparent)' }} />
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

      {/* App Grid — folder mode or flat search results */}
      <div className="ios-grid-enter w-full max-w-[1320px] mx-auto pb-1" style={{ marginTop: -4 }}>
        {search.trim() ? (
          /* Flat search results — show matching apps directly across all folders */
          <div className="w-full grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-x-4 gap-y-6">
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
          /* Folder grid - responsive command center layout */
          <AppFolderGrid badges={badges} tilt={tilt} />
        )}
      </div>



      {/* Property Finder — eyebrow + sync health note */}
      <div className="w-full max-w-[1320px] mx-auto mb-4 flex items-center gap-3">
        <p className="text-xs uppercase tracking-[0.3em] shrink-0" style={{ color: 'var(--ds-gold-lite, #eccd72)', opacity: 0.7, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
          Property Finder
        </p>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.3), transparent)' }} />
        {/* PF sync health note */}
        {pfSyncHealth && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--ds-muted, #8a93ab)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: pfSyncHealth.connectionState === 'connected' ? '#7ce8c4' : 'var(--ds-muted-dim, #5d6680)' }} />
              {pfSyncHealth.connectionState === 'connected' ? 'Connected' : 'Not connected'}
              {pfSyncHealth.lastSync && (
                <span style={{ color: 'var(--ds-muted-dim, #5d6680)' }}>
                  · synced {formatDistanceToNow(new Date(pfSyncHealth.lastSync), { addSuffix: true })}
                </span>
              )}
            </span>
            {pfSyncHealth.failedCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold" style={{ background: 'rgba(244,63,94,.16)', color: '#f7a9b8', border: '1px solid rgba(244,63,94,.3)' }}>
                {pfSyncHealth.failedCount} failed to sync
              </span>
            )}
          </div>
        )}
      </div>
      <div className="w-full max-w-[1320px] mx-auto">
        <PFListingsGrid />
      </div>

      {/* Evaluation Panel */}
      <EvaluationPanel 
        landlords={landlordsWithQuals} 
        onUploadFormA={() => navigate('/form-a-inbox')} 
      />

      {/* AI Insights + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 w-full max-w-[1320px] mt-0 mx-auto">
        <EruditeSection title="AI Insights" subtitle="Your Intelligence Hub" icon={Brain}>
          <AIInsightsDashboard />
        </EruditeSection>
        <EruditeSection title="Form A Contracts" subtitle="Recent Mandates" icon={FileText}>
          {isLoadingFormA ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
            </div>
          ) : (
            <FormADashboardWidget forms={formAWithLandlords} />
          )}
        </EruditeSection>
        <EruditeSection title="Photography" subtitle="Production Pipeline" icon={Camera}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Photography Pipeline</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'hsl(38 92% 50%)' }}
            >
              <Users className="w-3 h-3" />
              {photoData?.totalTasks || 0} tasks
            </div>
          </div>
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
    </div>
  );
}