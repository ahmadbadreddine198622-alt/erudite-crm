// ShortLinkRedirect — serves `/u/:slug` for iMessage rich link previews.
//
// When iMessage scrapes this URL, it reads the OG meta tags from index.html
// (static, served for all routes) and renders a rich preview card with the
// branded image, title, and description. Human visitors are redirected to
// the real destination (Property Finder profile, property URL, etc.).
//
// OG tags live in index.html because social/preview scrapers do NOT execute
// JavaScript — they read the raw HTML <head>. Adding more slugs: extend
// the DESTINATIONS map below.

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