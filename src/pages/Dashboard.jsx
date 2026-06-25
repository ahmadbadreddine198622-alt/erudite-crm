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
import { Brain, Zap } from 'lucide-react';
import FormADashboardWidget from '@/components/dashboard/FormADashboardWidget';
import EvaluationPanel from '@/components/dashboard/EvaluationPanel';
import { QUOTES } from '@/components/dashboard/MotivationalQuote';
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
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const pressTimer = useRef(null);
  const cueTimer = useRef(null);
  const menuRef = useRef(null);

  // Rotate quotes every 2 minutes (same as original MotivationalQuote component)
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 120000);
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
      className="relative min-h-screen flex flex-col px-4 pb-6 pt-4"
      style={{
        background: 'linear-gradient(180deg, #0B1F3A 0%, #071224 60%, #050A14 100%)',
      }}
    >
      {/* Compact Hero Banner */}
      <div className="w-full max-w-6xl mx-auto mb-4 scale-95" style={{ transformOrigin: 'top center' }}>
        <EruditeHeroBanner />
      </div>

      {/* Smart Search Bar with Motivational Quote Placeholder */}
      <div className="relative mb-4 w-full max-w-lg mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={search ? '' : QUOTES[quoteIndex]}
          className="w-full pl-11 pr-4 py-3 rounded-full text-sm border focus:outline-none transition-all"
          style={{
            background: 'rgba(26,43,61,0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(58,77,101,0.6)',
            color: 'rgba(255,255,255,0.95)',
            fontSize: '13px',
            fontStyle: search ? 'normal' : 'italic',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'hsl(38 92% 50% / 0.6)';
            e.target.style.background = 'rgba(30,50,75,0.9)';
            e.target.style.boxShadow = '0 0 0 2px hsl(38 92% 50% / 0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(58,77,101,0.6)';
            e.target.style.background = 'rgba(26,43,61,0.85)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {/* Subtle search hint icon on right */}
        {!search && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Search className="w-3 h-3" style={{ color: 'hsl(38 92% 50%)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Logged-in account badge with foldable profile */}
      {userEmail && (
        <div className="absolute top-0 right-0 z-50" ref={menuRef}>
          {/* Collapsed/Expanded Profile Toggle */}
          <div
            onClick={() => setIsProfileExpanded(!isProfileExpanded)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105"
            style={{
              background: isProfileExpanded ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
              border: isProfileExpanded ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(12px)',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
              style={{ background: userProfileImage ? 'transparent' : 'hsl(38 92% 50% / 0.25)', color: 'hsl(38 92% 55%)' }}
            >
              {userProfileImage ? (
                <img src={userProfileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (userName || userEmail)[0].toUpperCase()
              )}
            </div>
            {isProfileExpanded && (
              <div className="flex flex-col items-start gap-0 overflow-hidden">
                <span style={{ color: 'hsl(38 92% 55%)' }} className="font-semibold text-xs">{userName || userEmail}</span>
                {userPosition && <span className="text-[8px] uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)', opacity: 0.7 }}>{userPosition}</span>}
              </div>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${isProfileExpanded ? 'rotate-180' : ''}`} style={{ color: 'hsl(38 92% 55%)' }} />
          </div>

          {/* Expanded Profile Details */}
          {isProfileExpanded && (
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
                  onClick={() => { navigate('/team'); setIsProfileExpanded(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Users className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Team Management</span>
                </button>
                <button
                  onClick={() => { navigate('/landlords'); setIsProfileExpanded(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Building2 className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Landlord Pipeline</span>
                </button>
                <button
                  onClick={() => { navigate('/leads'); setIsProfileExpanded(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <UserCheck className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Assign Leads</span>
                </button>
                <button
                  onClick={() => { navigate('/analytics'); setIsProfileExpanded(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Analytics</span>
                </button>
                <button
                  onClick={() => { navigate('/finance'); setIsProfileExpanded(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <FileText className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Finance</span>
                </button>
                <button
                  onClick={() => { navigate('/profile'); setIsProfileExpanded(false); }}
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

      {/* KPI Strip - tight horizontal dashboard metric bar */}
      <div
        className="grid grid-cols-4 w-full max-w-6xl mx-auto gap-2 mb-5"
        style={{}}
      >
        {/* Active Leads */}
        <button
          onClick={() => navigate('/leads')}
          className="group flex flex-col items-center justify-center py-3 px-2 transition-all rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(217,138,48,0.3)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="flex items-center justify-center mb-1.5" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(217,138,48,0.12)', border: '1px solid rgba(217,138,48,0.25)' }}>
            <Users className="w-3.5 h-3.5" style={{ color: '#d98a30' }} />
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#d98a30', lineHeight: 1 }}>{badges.leads}</p>
          <p className="uppercase font-medium mt-1" style={{ fontSize: 8, letterSpacing: '0.12em', color: 'rgba(125,131,150,0.7)' }}>ACTIVE</p>
        </button>

        {/* Reminders */}
        <button
          onClick={() => navigate('/reminders')}
          className="group flex flex-col items-center justify-center py-3 px-2 transition-all rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(217,138,48,0.3)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="flex items-center justify-center mb-1.5" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(217,138,48,0.12)', border: '1px solid rgba(217,138,48,0.25)' }}>
            <Bell className="w-3.5 h-3.5" style={{ color: '#d98a30' }} />
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#d98a30', lineHeight: 1 }}>{badges.reminders}</p>
          <p className="uppercase font-medium mt-1" style={{ fontSize: 8, letterSpacing: '0.12em', color: 'rgba(125,131,150,0.7)' }}>REMINDERS</p>
        </button>

        {/* Unread */}
        <button
          onClick={() => navigate('/whatsapp')}
          className="group flex flex-col items-center justify-center py-3 px-2 transition-all rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(217,138,48,0.3)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="flex items-center justify-center mb-1.5" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(217,138,48,0.12)', border: '1px solid rgba(217,138,48,0.25)' }}>
            <MessageCircle className="w-3.5 h-3.5" style={{ color: '#d98a30' }} />
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#d98a30', lineHeight: 1 }}>{badges.whatsapp}</p>
          <p className="uppercase font-medium mt-1" style={{ fontSize: 8, letterSpacing: '0.12em', color: 'rgba(125,131,150,0.7)' }}>UNREAD</p>
        </button>

        {/* Hot Leads */}
        <button
          onClick={() => navigate('/leads')}
          className="group flex flex-col items-center justify-center py-3 px-2 transition-all rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(36,167,125,0.3)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div className="flex items-center justify-center mb-1.5" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(36,167,125,0.12)', border: '1px solid rgba(36,167,125,0.25)' }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: '#24a77d' }} />
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#24a77d', lineHeight: 1 }}>{hotLeads}</p>
          <p className="uppercase font-medium mt-1" style={{ fontSize: 8, letterSpacing: '0.12em', color: 'rgba(125,131,150,0.7)' }}>HOT</p>
        </button>
      </div>

      {/* WORKSPACES section header */}
      <div className="w-full max-w-6xl mx-auto mb-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
          <span className="text-[10px] uppercase font-semibold tracking-[0.15em]" style={{ color: 'hsl(38 92% 50% / 0.7)' }}>Workspaces</span>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
        </div>
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
      <div className="ios-grid-enter w-full max-w-6xl mx-auto pb-2" style={{ marginTop: -8 }}>
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



      {/* Property Finder Listings */}
      <EruditeSection title="Property Finder" subtitle="My Active Listings" icon={Building2} className="w-full max-w-5xl mt-0 mx-auto">
        <PFListingsGrid />
      </EruditeSection>

      {/* Evaluation Panel */}
      <EvaluationPanel 
        landlords={landlordsWithQuals} 
        onUploadFormA={() => navigate('/form-a-inbox')} 
      />

      {/* AI Insights + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 w-full max-w-5xl mt-0 mx-auto">
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
  );
}