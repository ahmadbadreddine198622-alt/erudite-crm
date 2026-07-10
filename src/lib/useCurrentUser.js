import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { isOwner } from '@/lib/owners';

let cachedUser = null;
let cachedRoles = null;

export function useCurrentUser() {
  const [user, setUser] = useState(cachedUser);
  const [roles, setRoles] = useState(cachedRoles || []);
  const [loading, setLoading] = useState(!cachedUser);

  // Always re-fetch me() on mount. The module-level cache gives an instant first
  // render, but a stale cache (e.g. user configured their WhatsApp instance in
  // Profile after the app first loaded) must not block features that gate on the
  // latest profile fields — notably whatsapp_instance, which controls whether the
  // landlord-detail WhatsApp send button is enabled.
  useEffect(() => {
    let mounted = true;
    Promise.all([
      base44.auth.me().catch(() => null),
      cachedRoles && cachedRoles.length ? Promise.resolve(cachedRoles) : base44.entities.Role.list().catch(() => []),
    ]).then(([u, r]) => {
      if (!mounted) return;
      // Normalize: the built-in full_name is read-only, so users update their name
      // via display_name in Profile. Expose display_name as full_name so every
      // component reading user.full_name shows the current name everywhere.
      const normalizedUser = u ? { ...u, full_name: u.display_name || u.full_name } : u;
      cachedUser = normalizedUser;
      cachedRoles = r;
      setUser(normalizedUser);
      setRoles(r);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const customRole = user?.custom_role_id
    ? roles.find(r => r.id === user.custom_role_id)
    : null;

  const owner = isOwner(user?.email); // owners bypass every restriction
  const isAdmin = owner || user?.role === 'admin';
  const isCEO = owner || user?.role === 'ceo';
  const isManager = owner || user?.role === 'admin' || user?.role === 'manager' || user?.role === 'ceo';
  // canCoach — only senior leadership (senior admin, director, CEO) can add coaching
  // comments on activity items in the landlord timeline.
  const isDirector = !!(customRole?.name && customRole.name.toLowerCase().includes('director'));
  const canCoach = owner || user?.role === 'admin' || user?.role === 'ceo' || isDirector;

  const MALIK_EMAIL = 'malik@erudite-estate.com';
  const isMalik = user?.email === MALIK_EMAIL;

  // Property Finder visibility is restricted to these five people.
  // Matched against the user's full name tokens and email local-part.
  const PF_VIEW_NAMES = ['ajwa', 'malik', 'dari', 'ahmad', 'francis'];
  const _fn = (user?.full_name || '').toLowerCase();
  const _emailLocal = (user?.email || '').split('@')[0].toLowerCase();
  const _tokens = _fn.split(/[\s._-]+/).filter(Boolean);
  const _nameMatch = PF_VIEW_NAMES.some(n => _tokens.includes(n) || _fn.includes(n) || _emailLocal.includes(n));
  const canViewPropertyFinder = owner || _nameMatch;

  const permissions = {
    view_all_leads: owner || isAdmin || isCEO || customRole?.permissions?.view_all_leads || false,
    view_all_pipeline: owner || isAdmin || isCEO || customRole?.permissions?.view_all_pipeline || false,
    view_all_whatsapp: owner || isAdmin || isCEO || customRole?.permissions?.view_all_whatsapp || false,
    view_all_landlords: owner || isAdmin || isCEO || customRole?.permissions?.view_all_landlords || false,
    view_malik_whatsapp: owner || isAdmin || isCEO || isMalik || false,
    view_finance: owner || isAdmin || isCEO || customRole?.permissions?.view_finance || false,
    view_analytics: owner || isAdmin || isManager || customRole?.permissions?.view_analytics || false,
    manage_team: owner || isAdmin || isCEO || customRole?.permissions?.manage_team || false,
    manage_landlords: owner || isAdmin || isCEO || customRole?.permissions?.manage_landlords || false,
    manage_properties: owner || isAdmin || isCEO || customRole?.permissions?.manage_properties || false,
    export_data: owner || isAdmin || isCEO || customRole?.permissions?.export_data || false,
  };

  return { user, loading, isAdmin, isManager, isOwner: owner, canCoach, permissions, customRole, isMalik, canViewPropertyFinder };
}