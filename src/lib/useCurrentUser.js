import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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

  const isAdmin = user?.role === 'admin';
  const isCEO = user?.role === 'ceo';
  const isManager = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'ceo';

  const customRole = user?.custom_role_id
    ? roles.find(r => r.id === user.custom_role_id)
    : null;

  const permissions = {
    view_all_leads: isAdmin || isCEO || customRole?.permissions?.view_all_leads || false,
    view_all_pipeline: isAdmin || isCEO || customRole?.permissions?.view_all_pipeline || false,
    view_all_whatsapp: isAdmin || isCEO || customRole?.permissions?.view_all_whatsapp || false,
    view_all_landlords: isAdmin || isCEO || customRole?.permissions?.view_all_landlords || false,
    view_finance: isAdmin || isCEO || customRole?.permissions?.view_finance || false,
    view_analytics: isAdmin || isManager || customRole?.permissions?.view_analytics || false,
    manage_team: isAdmin || isCEO || customRole?.permissions?.manage_team || false,
    manage_landlords: isAdmin || isCEO || customRole?.permissions?.manage_landlords || false,
    manage_properties: isAdmin || isCEO || customRole?.permissions?.manage_properties || false,
    export_data: isAdmin || isCEO || customRole?.permissions?.export_data || false,
  };

  return { user, loading, isAdmin, isManager, permissions, customRole };
}