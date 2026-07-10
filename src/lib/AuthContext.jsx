import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

// Organization email allowlist: only @erudite-estate.com addresses plus two
// approved personal emails may access the CRM. Anyone else is blocked.
const ALLOWED_DOMAIN = 'erudite-estate.com';
const ALLOWED_EMAILS = [
  'maroofali551@gmail.com',
  'ahmad.badreddine198622@gmail.com',
  'ahmad@erudite-estate.com',
];

function isEmailAllowed(email) {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (ALLOWED_EMAILS.includes(e)) return true;
  return e.endsWith('@' + ALLOWED_DOMAIN);
}


const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.

      
      try {
        const resp = await fetch(`/api/apps/public/prod/public-settings/by-id/${appParams.appId}`, {
          headers: { 'X-App-Id': appParams.appId, ...(appParams.token ? { 'Authorization': `Bearer ${appParams.token}` } : {}) }
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const err = new Error(errData.message || 'Failed');
          err.status = resp.status;
          err.data = errData;
          throw err;
        }
        const publicSettings = await resp.json();
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated - with timeout for mobile
      setIsLoadingAuth(true);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 8000)
      );
      const authPromise = base44.auth.me();
      const currentUser = await Promise.race([authPromise, timeoutPromise]);

      // Enforce the organization email allowlist. A user who somehow has an
      // account with a non-org / non-approved email is blocked immediately.
      if (!isEmailAllowed(currentUser?.email)) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'domain_not_allowed',
          message: 'Your email is not on the organization allowlist',
          email: currentUser?.email,
        });
        setIsLoadingAuth(false);
        return;
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Redirect to login, then to dashboard after login
    base44.auth.redirectToLogin('/');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};