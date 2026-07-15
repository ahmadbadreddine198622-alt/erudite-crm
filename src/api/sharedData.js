import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAllRecords } from '@/api/fetchAll';

/**
 * Shared full-table data hooks — single cached copy per entity.
 *
 * PROBLEM SOLVED: the full Landlord table (~700 fat records incl. AI brain
 * fields) was fetched under 4+ DIFFERENT query keys ('landlords',
 * 'landlords-for-messages', 'landlords-for-link', 'landlords-lease'), so every
 * page paid the full multi-second download again. Same story for Lead
 * (~1,600 records under 'leads' and 'pipeline-leads').
 *
 * These hooks give every read-only consumer ONE shared cache entry.
 *
 * KEY DESIGN — prefix-matched invalidation:
 *   - Landlord key is ['landlords', 'all']  → the 29 existing
 *     invalidateQueries({ queryKey: ['landlords'] }) calls across the app
 *     invalidate it automatically (react-query prefix matching).
 *   - Lead key stays ['leads'] (the canonical key already shared by
 *     Leads.jsx + WhatsAppInbox.jsx and invalidated by mutations).
 *   Do NOT rename these keys without updating the invalidation wiring.
 *
 * staleTime: navigation within the window reuses cache instantly; mutations
 * still force-refresh via invalidateQueries regardless of staleTime.
 *
 * Ordering: data is fetched '-created_date'. If a consumer needs a different
 * order (e.g. alphabetical pickers), sort client-side in a useMemo — do not
 * add a differently-sorted duplicate query.
 */

export const LANDLORDS_ALL_KEY = ['landlords', 'all'];
export const LEADS_ALL_KEY = ['leads'];

export function useAllLandlords(options = {}) {
  return useQuery({
    queryKey: LANDLORDS_ALL_KEY,
    queryFn: () => fetchAllRecords(base44.entities.Landlord, '-created_date'),
    staleTime: 5 * 60_000,
    ...options,
  });
}

export function useAllLeads(options = {}) {
  return useQuery({
    queryKey: LEADS_ALL_KEY,
    queryFn: () => fetchAllRecords(base44.entities.Lead, '-created_date'),
    staleTime: 2 * 60_000,
    ...options,
  });
}
