// ShortLinkRedirect — React fallback for `/u/:slug` routes.
//
// PRIMARY: Static HTML files at /public/u/*.html are served directly for
// iMessage/OG scrapers (they don't execute JS). These have full OG tags.
//
// FALLBACK: This React component handles human visitors when the static
// file doesn't exist or for client-side navigation testing.

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const DESTINATIONS = {
  ahmad: 'https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264',
  linkedin: 'https://www.linkedin.com/in/badreddine-ahmad-34b4679b',
};

export default function ShortLinkRedirect() {
  const { slug } = useParams();

  useEffect(() => {
    const dest = DESTINATIONS[slug] || 'https://eruditeproperty.com';
    window.location.replace(dest);
  }, [slug]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A1628',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <style>{`@keyframes slr-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid rgba(245,158,11,0.3)',
            borderTopColor: '#F59E0B',
            borderRadius: '50%',
            animation: 'slr-spin 0.7s linear infinite',
            margin: '0 auto 12px',
          }}
        />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
          Redirecting to Erudite…
        </p>
      </div>
    </div>
  );
}