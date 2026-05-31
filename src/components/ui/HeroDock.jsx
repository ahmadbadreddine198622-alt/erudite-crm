/**
 * HeroDock — redesigned floating dock with customization and AI suggestions.
 * Features:
 * - Customizable apps via user preferences (dock_apps array)
 * - AI-suggested slot based on recent activity
 * - Elevated floating surface with distinct edge and shadow
 * - Edit mode for managing visible apps
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MoreHorizontal, Sparkles, Pencil, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ALL_APPS } from '@/lib/navApps';

// Default apps if user hasn't customized yet
const DEFAULT_DOCK_APPS = ['/pipeline', '/leads', '/landlords', '/whatsapp', '/finance'];

// Map routes to suggested next apps based on context
const CONTEXT_SUGGESTIONS = {
  '/pipeline': ['/leads', '/whatsapp', '/reminders'],
  '/leads': ['/pipeline', '/whatsapp', '/contacts'],
  '/landlords': ['/property-finder', '/offers', '/pipeline'],
  '/whatsapp': ['/leads', '/pipeline', '/reminders'],
  '/finance': ['/commissions', '/leads', '/analytics'],
  '/reminders': ['/pipeline', '/leads', '/calendar'],
  '/analytics': ['/team-dashboard', '/sales-analytics', '/leads'],
  '/team': ['/team-dashboard', '/analytics', '/leaderboard'],
};

// Get all available dock apps (excluding home)
const getAvailableApps = () => {
  return ALL_APPS.filter(app => 
    app.path && 
    app.path !== '/' && 
    !app.label.includes('Dashboard')
  ).slice(0, 20); // Limit to top 20 for picker
};

function DockIcon({ icon: Icon, gradient, active, label, onClick, showEditBadge, onRemove, isSuggestion }) {
  const [pressed, setPressed] = useState(false);
  const size = 50;
  const radius = `${Math.round(size * 0.22)}px`;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 px-3.5 py-1.5 cursor-pointer select-none transition-all duration-200',
        pressed ? 'scale-[0.96]' : active ? 'scale-105' : 'scale-100 hover:scale-[1.02]'
      )}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onClick}
    >
      {/* Edit remove badge */}
      {showEditBadge && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1 -right-1 z-20 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border border-red-300/30 shadow-md hover:bg-red-600 transition-colors"
        >
          <X className="w-3 h-3 text-white" strokeWidth={3} />
        </button>
      )}

      <div style={{ width: size, height: size, borderRadius: radius, position: 'relative' }}>
        {/* Deep jewel-tone inner glow */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-72', gradient)}
          style={{ borderRadius: radius, filter: 'saturate(0.35) brightness(0.5)' }}
        />

        {/* Frosted crystal shell */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active ? 'rgba(245,159,10,0.14)' : 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(160%)',
            WebkitBackdropFilter: 'blur(32px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderTopColor: active ? 'rgba(245,159,10,0.38)' : 'rgba(255,255,255,0.22)',
            boxShadow: active
              ? '0 6px 20px rgba(245,159,10,0.22), inset 0 1px 0 rgba(255,255,255,0.14)'
              : '0 5px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
            transition: 'all 0.2s ease',
          }}
        />

        {/* Fine polished rim */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 48%)',
            pointerEvents: 'none',
          }}
        />

        {/* Glyph */}
        <Icon
          className="absolute"
          style={{
            width: Math.round(size * 0.46),
            height: Math.round(size * 0.46),
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: active ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.88)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))',
            zIndex: 2,
          }}
        />

        {/* AI suggestion sparkle */}
        {isSuggestion && (
          <Sparkles className="absolute -top-1 -left-1 w-3.5 h-3.5 text-amber-400" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
        )}
      </div>

      {/* Label */}
      <span className={cn('text-[10px] font-medium tracking-wide transition-colors', active ? 'text-amber-500' : 'text-white/55')}>
        {label}
      </span>
    </div>
  );
}

function AppPickerSheet({ isOpen, onClose, currentApps, onToggleApp }) {
  const availableApps = getAvailableApps();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card w-full max-w-lg max-h-[80vh] rounded-t-2xl md:rounded-2xl border border-border overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Customize Dock</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <p className="text-xs text-muted-foreground mb-3">Toggle apps to show in your dock</p>
          <div className="grid grid-cols-2 gap-2">
            {availableApps.map(app => {
              const isSelected = currentApps.includes(app.path);
              const Icon = app.icon;
              return (
                <button
                  key={app.path}
                  onClick={() => onToggleApp(app.path)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border transition-all',
                    isSelected 
                      ? 'bg-accent/10 border-accent/30 text-foreground' 
                      : 'bg-card hover:bg-accent/5 border-border text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium flex-1 text-left">{app.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroDock() {
  const location = useLocation();
  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const qc = useQueryClient();
  
  // Auto-hide state for desktop
  const [isHovering, setIsHovering] = useState(false);
  const [isRevealed, setIsRevealed] = useState(true);
  
  // Mobile landscape collapse state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Load user email and detect device/motion preferences
  useEffect(() => {
    base44.auth.me().then(u => { if (u?.email) setUserEmail(u.email); }).catch(() => {});
    
    // Detect reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    const motionHandler = (e) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', motionHandler);
    
    // Detect mobile landscape orientation
    const updateOrientation = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isLandscape = window.innerWidth > window.innerHeight;
      const isNarrow = window.innerWidth < 768;
      setIsMobileLandscape(isTouch && isLandscape && isNarrow);
      if (!isLandscape) setIsCollapsed(false);
    };
    
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    
    return () => {
      motionQuery.removeEventListener('change', motionHandler);
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);
  
  // Desktop auto-hide behavior
  useEffect(() => {
    if (isMobileLandscape) return; // Skip on mobile landscape
    
    let hideTimer;
    
    const handleMouseMove = (e) => {
      const nearBottom = e.clientY > window.innerHeight - 80;
      if (nearBottom) {
        setIsRevealed(true);
        clearTimeout(hideTimer);
      } else {
        hideTimer = setTimeout(() => {
          if (!isHovering) setIsRevealed(false);
        }, 2000);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimer);
    };
  }, [isMobileLandscape, isHovering]);

  // Load dock apps from user preferences (localStorage for now)
  const { data: dockApps = DEFAULT_DOCK_APPS } = useQuery({
    queryKey: ['dock-apps', userEmail],
    queryFn: () => {
      try {
        const saved = localStorage.getItem(`dock_apps_${userEmail || 'default'}`);
        return saved ? JSON.parse(saved) : DEFAULT_DOCK_APPS;
      } catch {
        return DEFAULT_DOCK_APPS;
      }
    },
    enabled: !!userEmail,
  });

  const saveDockApps = useMutation({
    mutationFn: async (apps) => {
      localStorage.setItem(`dock_apps_${userEmail || 'default'}`, JSON.stringify(apps));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dock-apps', userEmail] });
    },
  });

  // Get recent activity to suggest next app
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity', userEmail],
    queryFn: async () => {
      try {
        const activities = await base44.entities.LeadActivity.list('-created_date', 10);
        return activities;
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  // Determine AI-suggested app
  const suggestedApp = (() => {
    if (!recentActivity || recentActivity.length === 0) return null;
    
    // Get current context suggestions
    const currentContext = Object.keys(CONTEXT_SUGGESTIONS).find(key => 
      location.pathname.startsWith(key)
    );
    
    const suggestions = currentContext 
      ? CONTEXT_SUGGESTIONS[currentContext]
      : ['/pipeline', '/leads', '/whatsapp'];
    
    // Find first suggestion not already in dock and not current page
    for (const path of suggestions) {
      if (path !== location.pathname && !dockApps.includes(path)) {
        const app = ALL_APPS.find(a => a.path === path);
        if (app) return app;
      }
    }
    
    return null;
  })();

  const handleToggleApp = (appPath) => {
    const newApps = dockApps.includes(appPath)
      ? dockApps.filter(a => a !== appPath)
      : [...dockApps, appPath];
    
    // Ensure min/max constraints
    if (newApps.length < 3) return;
    if (newApps.length > 6) return;
    
    saveDockApps.mutate(newApps);
  };

  const handleRemoveApp = (appPath) => {
    if (dockApps.length <= 3) return;
    saveDockApps.mutate(dockApps.filter(a => a !== appPath));
  };

  // Build dock items: apps + optional suggestion + more button
  const dockItems = [];
  
  // Add user's selected apps
  dockApps.forEach(appPath => {
    const app = ALL_APPS.find(a => a.path === appPath);
    if (app) {
      dockItems.push({
        ...app,
        isSuggestion: false,
      });
    }
  });

  // Add AI suggestion if available and not already in dock
  if (suggestedApp && !dockApps.includes(suggestedApp.path) && dockItems.length < 5) {
    dockItems.push({
      ...suggestedApp,
      isSuggestion: true,
    });
  }

  return (
    <>
      {/* Desktop / Mac dock with auto-hide */}
      {!isMobileLandscape && (
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 hidden md:block" 
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom)',
          transition: prefersReducedMotion ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isRevealed ? 'translateY(0)' : 'translateY(120%)',
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="mx-auto max-w-3xl px-4 pb-8" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
          {/* Elevated dock surface — distinct floating layer */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(15,20,35,0.95) 0%, rgba(8,11,18,0.98) 100%)',
              backdropFilter: 'blur(48px) saturate(220%)',
              WebkitBackdropFilter: 'blur(48px) saturate(220%)',
              borderRadius: '28px',
              border: '1px solid rgba(255,255,255,0.12)',
              borderTopColor: 'rgba(255,255,255,0.20)',
              boxShadow: `
                0 -8px 32px rgba(0,0,0,0.4),
                0 24px 64px rgba(0,0,0,0.6),
                inset 0 1px 0 rgba(255,255,255,0.08),
                inset 0 -1px 0 rgba(0,0,0,0.3)
              `,
              padding: '10px 14px 10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              position: 'relative',
            }}
          >
            {/* Enhanced gold rim frame */}
            <div className="absolute inset-0" style={{ 
              borderRadius: '28px', 
              border: '1px solid rgba(245,159,10,0.18)',
              boxShadow: '0 0 24px rgba(245,159,10,0.08)',
              pointerEvents: 'none' 
            }} />

            {/* Edit mode toggle */}
            {editMode && (
              <button
                onClick={() => { setEditMode(false); setShowPicker(true); }}
                className="absolute -top-12 right-0 px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-semibold flex items-center gap-1.5 hover:bg-accent/30 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Dock
              </button>
            )}

            {/* Dock apps */}
            {dockItems.slice(0, 5).map((item) => (
              <Link key={item.path} to={item.path}>
                <DockIcon
                  icon={item.icon}
                  gradient={item.gradient}
                  active={location.pathname === item.path}
                  label={item.label}
                  isSuggestion={item.isSuggestion}
                  showEditBadge={editMode}
                  onRemove={() => handleRemoveApp(item.path)}
                />
              </Link>
            ))}

            {/* Elevated center home button */}
            <div style={{ position: 'relative', top: '-22px', zIndex: 10, margin: '0 4px' }}>
              <Link to="/">
                <button
                  className="transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] group"
                  style={{
                    width: 68, height: 68,
                    borderRadius: '22%',
                    background: 'rgba(245,159,10,0.12)',
                    backdropFilter: 'blur(36px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(36px) saturate(200%)',
                    border: '2px solid rgba(245,159,10,0.42)',
                    borderTopColor: 'rgba(255,255,255,0.45)',
                    boxShadow: '0 18px 52px rgba(245,159,10,0.32), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 44px rgba(245,159,10,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 opacity-35" style={{ borderRadius: '22%' }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[2000ms]"
                    style={{ borderRadius: '22%', background: 'linear-gradient(125deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0) 55%)', animation: 'shimmer 4s ease-in-out infinite', pointerEvents: 'none' }} />
                  <div className="absolute inset-0" style={{ borderRadius: '22%', background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 52%)', pointerEvents: 'none' }} />
                  <Home className="relative z-10" style={{ width: 32, height: 32, color: 'hsl(38 92% 50%)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))' }} />
                </button>
              </Link>
            </div>

            {/* More button with edit trigger */}
            <div className="relative">
              <Link to="/reminders">
                <DockIcon
                  icon={editMode ? Pencil : MoreHorizontal}
                  gradient="from-slate-700 to-slate-900"
                  active={false}
                  label={editMode ? 'Edit' : 'More'}
                  onClick={(e) => {
                    if (editMode) {
                      e.preventDefault();
                      setEditMode(false);
                    }
                  }}
                />
              </Link>
              
              {/* Long-press to enter edit mode */}
              <button
                className="absolute inset-0 z-30"
                onContextMenu={(e) => { e.preventDefault(); setEditMode(true); }}
                onTouchStart={() => {}}
                onTouchEnd={() => {}}
              />
            </div>
          </div>
        </div>
      </nav>
      )}

      {/* Mobile landscape collapsed dock */}
      {isMobileLandscape && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto px-4 pb-6" style={{ display: 'flex', justifyContent: 'center' }}>
            {isCollapsed ? (
              /* Collapsed single button */
              <button
                onClick={() => setIsCollapsed(false)}
                className="transition-transform duration-300 hover:scale-105 active:scale-95"
                style={{
                  width: 64, height: 64,
                  borderRadius: '20px',
                  background: 'rgba(245,159,10,0.15)',
                  backdropFilter: 'blur(36px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(36px) saturate(200%)',
                  border: '2px solid rgba(245,159,10,0.45)',
                  borderTopColor: 'rgba(255,255,255,0.5)',
                  boxShadow: '0 16px 48px rgba(245,159,10,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Home className="w-8 h-8" style={{ color: 'hsl(38 92% 50%)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))' }} />
              </button>
            ) : (
              /* Expanded dock */
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(15,20,35,0.95) 0%, rgba(8,11,18,0.98) 100%)',
                  backdropFilter: 'blur(48px) saturate(220%)',
                  WebkitBackdropFilter: 'blur(48px) saturate(220%)',
                  borderRadius: '28px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderTopColor: 'rgba(255,255,255,0.20)',
                  boxShadow: `
                    0 -8px 32px rgba(0,0,0,0.4),
                    0 24px 64px rgba(0,0,0,0.6),
                    inset 0 1px 0 rgba(255,255,255,0.08),
                    inset 0 -1px 0 rgba(0,0,0,0.3)
                  `,
                  padding: '10px 14px 10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  position: 'relative',
                  transition: prefersReducedMotion ? 'none' : 'all 0.3s ease',
                }}
              >
                {/* Close button */}
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="absolute -top-10 right-0 p-2 rounded-full bg-card/80 border border-border hover:bg-accent/20 transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
                
                {/* Dock apps */}
                {dockItems.slice(0, 5).map((item) => (
                  <Link key={item.path} to={item.path} onClick={() => setIsCollapsed(true)}>
                    <DockIcon
                      icon={item.icon}
                      gradient={item.gradient}
                      active={location.pathname === item.path}
                      label={item.label}
                      isSuggestion={item.isSuggestion}
                      showEditBadge={editMode}
                      onRemove={() => handleRemoveApp(item.path)}
                    />
                  </Link>
                ))}

                {/* Elevated center home button */}
                <div style={{ position: 'relative', top: '-22px', zIndex: 10, margin: '0 4px' }}>
                  <Link to="/" onClick={() => setIsCollapsed(true)}>
                    <button
                      className="transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] group"
                      style={{
                        width: 68, height: 68,
                        borderRadius: '22%',
                        background: 'rgba(245,159,10,0.12)',
                        backdropFilter: 'blur(36px) saturate(200%)',
                        WebkitBackdropFilter: 'blur(36px) saturate(200%)',
                        border: '2px solid rgba(245,159,10,0.42)',
                        borderTopColor: 'rgba(255,255,255,0.45)',
                        boxShadow: '0 18px 52px rgba(245,159,10,0.32), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 44px rgba(245,159,10,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', position: 'relative',
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 opacity-35" style={{ borderRadius: '22%' }} />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[2000ms]"
                        style={{ borderRadius: '22%', background: 'linear-gradient(125deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0) 55%)', animation: 'shimmer 4s ease-in-out infinite', pointerEvents: 'none' }} />
                      <div className="absolute inset-0" style={{ borderRadius: '22%', background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 52%)', pointerEvents: 'none' }} />
                      <Home className="relative z-10" style={{ width: 32, height: 32, color: 'hsl(38 92% 50%)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))' }} />
                    </button>
                  </Link>
                </div>

                {/* More button */}
                <div className="relative">
                  <Link to="/reminders" onClick={() => setIsCollapsed(true)}>
                    <DockIcon
                      icon={editMode ? Pencil : MoreHorizontal}
                      gradient="from-slate-700 to-slate-900"
                      active={false}
                      label={editMode ? 'Edit' : 'More'}
                      onClick={(e) => {
                        if (editMode) {
                          e.preventDefault();
                          setEditMode(false);
                        }
                      }}
                    />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* App picker sheet */}
      <AppPickerSheet
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        currentApps={dockApps}
        onToggleApp={handleToggleApp}
      />
      
      {/* Desktop hover detection zone */}
      {!isMobileLandscape && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-40 hidden md:block"
          style={{ height: '60px' }}
          onMouseEnter={() => setIsRevealed(true)}
        />
      )}
    </>
  );
}