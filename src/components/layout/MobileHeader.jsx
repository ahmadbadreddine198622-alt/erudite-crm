import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * MobileHeader — iOS-style header that shows brand on root routes and Back button on child routes.
 */
export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  // Root routes that should show brand instead of back button
  const rootRoutes = ['/', '/dashboard', '/pipeline', '/leads', '/contacts', '/whatsapp', '/inbox', '/calendar'];
  const isRoot = rootRoutes.some(route => location.pathname === route || location.pathname.startsWith(route + '/'));

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 md:hidden"
      style={{
        background: 'rgba(10,14,30,0.85)',
        backdropFilter: 'blur(24px) saturate(200%)',
        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Back button or spacer */}
      {!isRoot ? (
        <button
          onClick={handleBack}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: 'hsl(38 92% 55%)' }} />
          <span className="text-sm font-medium" style={{ color: 'hsl(38 92% 55%)' }}>Back</span>
        </button>
      ) : (
        <div className="w-20" />
      )}

      {/* Brand logo */}
      <div className="flex items-center gap-2">
        <span
          className="text-lg font-semibold tracking-wide"
          style={{
            fontFamily: "'Playfair Display', serif",
            background: 'linear-gradient(180deg, #FFFFFF 0%, #D4AF37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          ERUDITE
        </span>
      </div>

      {/* Spacer for balance */}
      <div className="w-20" />
    </div>
  );
}