import React, { useEffect } from 'react';

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDone();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: '#0a0e1a' }}>
      <div className="w-full h-full max-w-6xl max-h-[80vh] flex items-center justify-center p-8">
        <img
          src="https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/2b89f2d25_WhatsAppImage2026-06-25at2022151.jpeg"
          alt="Erudite Real Estate"
          className="w-full h-full object-contain"
          style={{ maxWidth: '1200px', maxHeight: '600px' }}
        />
      </div>
    </div>
  );
}