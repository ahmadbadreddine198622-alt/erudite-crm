import { useState, useEffect, useRef } from 'react';
import { Search, Users, Building2, UserCheck, BarChart3, FileText, Settings, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * ERUDITE top bar — gold wordmark left, utilities right.
 * Preserves existing search routing and account menu behavior.
 */
export default function DashboardTopBar({
  search,
  setSearch,
  userName,
  userEmail,
  userRole,
  userPosition,
  userProfileImage,
  navigate,
}) {
  const now = useLiveClock();
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileExpanded(false);
      }
    };
    if (isProfileExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileExpanded]);

  const clockLabel = `${WEEKDAYS[now.getDay()]} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const initial = (userName || userEmail || '?')[0].toUpperCase();

  return (
    <div
      className="w-full flex flex-col sm:flex-row items-center sm:justify-center gap-4 sm:gap-4"
      style={{ maxWidth: '1320px', margin: '0 auto', paddingTop: '18px', paddingBottom: '14px' }}
    >
      {/* CENTER — Branding + clock (always centered, wraps to top lone on mobile) */}
      <div className="flex flex-col items-center">
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 'clamp(20px, 5.5vw, 24px)',
            letterSpacing: '0.30em',
            background: 'linear-gradient(92deg, #eccd72, #d4af37 55%, #b8862b)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          ERUDITE
        </span>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '9px',
            letterSpacing: '0.42em',
            fontWeight: 600,
            color: '#5d6680',
            marginTop: '4px',
            textAlign: 'center',
          }}
        >
          REAL ESTATE · DUBAI
        </span>
        {/* Modern live clock — Space Grotesk tabular, gold text */}
        <span
          className="hidden sm:block whitespace-nowrap"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '12px',
            letterSpacing: '0.18em',
            fontWeight: 400,
            color: '#c9a24b',
            fontVariantNumeric: 'tabular-nums',
            marginTop: '6px',
          }}
        >
          {clockLabel}
        </span>
      </div>

      {/* RIGHT — search pill + avatar (stacked below logo on mobile, beside on desktop) */}
      <div className="flex items-center sm:flex-none sm:justify-end w-full sm:w-auto" style={{ gap: '12px' }}>
        {/* Search pill */}
        <div
          className="flex items-center flex-1 sm:flex-initial"
          style={{
            height: '38px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '24px',
            padding: '0 14px',
          }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: '#5d6680' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads, listings, deals…"
            className="flex-1 bg-transparent outline-none border-none ml-2 min-w-0"
            style={{
              color: '#e8ecf6',
              fontSize: '13px',
              fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        {/* Avatar + account menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setIsProfileExpanded(!isProfileExpanded)}
            className="rounded-full flex items-center justify-center font-bold transition-transform hover:scale-105"
            style={{
              width: '40px',
              height: '40px',
              background: userProfileImage
                ? 'transparent'
                : 'linear-gradient(135deg, #eccd72, #b8862b)',
              color: '#0a0e1a',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '15px',
              boxShadow: '0 4px 14px rgba(212,175,55,0.4)',
              overflow: 'hidden',
            }}
          >
            {userProfileImage ? (
              <img src={userProfileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </button>

          {isProfileExpanded && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(15,20,30,0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(212,175,55,0.35)',
                zIndex: 9999,
              }}
            >
              <div className="p-3 border-b border-white/10">
                <p className="text-sm font-semibold" style={{ color: '#eccd72' }}>{userName || 'User'}</p>
                <p className="text-xs text-white/50">{userEmail}</p>
                {userRole && (
                  <div className="mt-1.5">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.15)', color: '#eccd72', border: '1px solid rgba(212,175,55,0.3)' }}>
                      {userRole}
                    </span>
                  </div>
                )}
              </div>
              <div className="py-2">
                {[
                  { icon: Users, label: 'Team Management', path: '/team' },
                  { icon: Building2, label: 'Landlord Pipeline', path: '/landlords' },
                  { icon: UserCheck, label: 'Assign Leads', path: '/leads' },
                  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
                  { icon: FileText, label: 'Finance', path: '/finance' },
                  { icon: Settings, label: 'Profile Settings', path: '/profile' },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setIsProfileExpanded(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                  >
                    <item.icon className="w-4 h-4" style={{ color: '#eccd72' }} />
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>{item.label}</span>
                  </button>
                ))}
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
      </div>
    </div>
  );
}