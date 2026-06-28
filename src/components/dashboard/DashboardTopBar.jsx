import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

/**
 * Gold "ERUDITE" wordmark top bar per spec:
 * - Left: gold gradient wordmark "ERUDITE" (letter-spacing 0.3em), caption "REAL ESTATE · DUBAI"
 * - Right: search pill, live clock (weekday · HH:MM, "DUBAI · GST" beneath), circular gold avatar
 */
export default function DashboardTopBar({ search, setSearch, userName, userEmail, userProfileImage }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const hhmm = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="flex items-center justify-between gap-4 w-full max-w-[1320px] mx-auto mb-8 flex-wrap">
      {/* Left: wordmark */}
      <div className="flex flex-col">
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '28px',
            letterSpacing: '0.3em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #eccd72 0%, #d4af37 50%, #b8862b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          ERUDITE
        </h1>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '9px',
            letterSpacing: '0.25em',
            color: 'var(--ds-muted, #8a93ab)',
            marginTop: '4px',
          }}
        >
          REAL ESTATE · DUBAI
        </span>
      </div>

      {/* Right: search + clock + avatar */}
      <div className="flex items-center gap-3">
        {/* Search pill */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{
            background: 'var(--ds-card, rgba(255,255,255,0.022))',
            border: '1px solid var(--ds-card-line, rgba(255,255,255,0.07))',
          }}
        >
          <div className="flex items-center px-4 py-2">
            <Search className="w-3.5 h-3.5 mr-2.5" style={{ color: 'var(--ds-gold-lite, #eccd72)', opacity: 0.6 }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads, listings, deals…"
              className="bg-transparent focus:outline-none"
              style={{
                color: 'var(--ds-ink, #e8ecf6)',
                fontSize: '12px',
                width: '200px',
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>
        </div>

        {/* Live clock */}
        <div className="flex flex-col items-end">
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--ds-ink, #e8ecf6)',
            letterSpacing: '0.05em',
          }}>
            {weekday} · {hhmm}
          </span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '8px',
            letterSpacing: '0.2em',
            color: 'var(--ds-muted-dim, #5d6680)',
          }}>
            DUBAI · GST
          </span>
        </div>

        {/* Gold avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
          style={{
            background: userProfileImage ? 'transparent' : 'linear-gradient(135deg, #eccd72, #b8862b)',
            color: '#0a0e1a',
            border: '1px solid rgba(212,175,55,0.4)',
            boxShadow: '0 0 12px rgba(212,175,55,0.3)',
          }}
        >
          {userProfileImage ? (
            <img src={userProfileImage} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (userName || userEmail || 'U')[0].toUpperCase()
          )}
        </div>
      </div>
    </div>
  );
}