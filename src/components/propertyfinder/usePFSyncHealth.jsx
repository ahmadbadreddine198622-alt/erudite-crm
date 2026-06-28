import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Fetches PFCredential connection state + last sync, and counts
 * PFListings with sync_status = 'error'. Used for the PF sync health note.
 */
export function usePFSyncHealth() {
  return useQuery({
    queryKey: ['pf-sync-health'],
    queryFn: async () => {
      let connectionState = 'unknown';
      let lastSync = null;
      let failedCount = 0;

      try {
        const creds = await base44.entities.PFCredential.list('-updated_date', 5);
        const active = creds.find(c => c.is_active) || creds[0];
        if (active) {
          connectionState = active.is_active ? 'connected' : 'disconnected';
          lastSync = active.last_sync_at || active.updated_date || null;
        }
      } catch { /* PFCredential may not exist yet */ }

      try {
        const failed = await base44.entities.PFListing.filter({ sync_status: 'error' }, '-updated_date', 50);
        failedCount = failed.length;
      } catch { /* ignore */ }

      return { connectionState, lastSync, failedCount };
    },
    staleTime: 60_000,
    retry: 1,
  });
}