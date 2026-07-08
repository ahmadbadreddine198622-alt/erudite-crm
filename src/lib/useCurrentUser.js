import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { isOwner } from '@/lib/owners';

let cachedUser = null;
let cachedRoles = null;

export function useCurrentUser() {
  const [user, setUser] = useState(cachedUser);
  const [roles, setRoles] = useState(cachedRoles || []);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    if (cachedUser) return;
    Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.Role.list().catch(() => []),
    ]).then(([u, r]) => {
      cachedUser = u;
      cachedRoles = r;
      setUser(u);
      setRoles(r);
      setLoading(false);
    });
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

  return { user, loading, isAdmin, isManager, isOwner: owner, canCoach, permissions, customRole };
}