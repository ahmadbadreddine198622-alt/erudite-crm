import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: '#0a0e1a' }}>
      {/* Erudite Real Estate Logo Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/2b89f2d25_WhatsAppImage2026-06-25at2022151.jpeg"
          alt="Erudite Real Estate"
          className="w-full h-full object-contain opacity-30"
          style={{ maxWidth: '1400px', maxHeight: '800px' }}
        />
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8" style={{ background: 'rgba(15,20,30,0.95)', backdropFilter: 'blur(20px)' }}>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}