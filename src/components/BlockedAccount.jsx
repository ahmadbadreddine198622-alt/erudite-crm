import React from 'react';
import { base44 } from '@/api/base44Client';

// Full-screen block shown when a logged-in user's email is not on the
// organization allowlist (not @erudite-estate.com and not one of the
// two approved personal emails).

export default function BlockedAccount({ email }) {
  const handleLogout = () => {
    base44.auth.logout(window.location.href);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="max-w-md w-full p-8 rounded-xl border border-border bg-card shadow-xl text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mx-auto">
          <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            This CRM is restricted to <strong>Erudite Real Estate</strong> team members only. Accounts outside the organization are automatically blocked.
          </p>
        </div>

        {email && (
          <div className="bg-muted rounded-lg px-4 py-3 text-sm text-muted-foreground">
            Signed in as: <span className="font-semibold text-foreground">{email}</span>
          </div>
        )}

        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-left space-y-1">
          <p className="font-medium text-foreground">Allowed emails:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Any <strong>@erudite-estate.com</strong> address</li>
            <li>Approved personal accounts (by admin request only)</li>
          </ul>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}