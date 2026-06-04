import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const UserNotRegisteredError = () => {
  const [email, setEmail] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setEmail(u?.email)).catch(() => {});
  }, []);

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
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
          <p className="text-muted-foreground text-sm">
            Your account is not registered for this CRM. Only invited team members can access this platform.
          </p>
        </div>

        {email && (
          <div className="bg-muted rounded-lg px-4 py-3 text-sm text-muted-foreground">
            Logged in as: <span className="font-semibold text-foreground">{email}</span>
          </div>
        )}

        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-left space-y-1">
          <p className="font-medium text-foreground">What to do:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Make sure you accepted your invitation email first</li>
            <li>Check you're signed in with your <strong>work email</strong> (not a personal account)</li>
            <li>Ask your admin to re-send your invitation</li>
          </ul>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Sign out &amp; Try a Different Account
        </button>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;