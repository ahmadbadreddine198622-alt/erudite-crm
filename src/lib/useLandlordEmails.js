import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Fetches the SHARED email stream for a landlord — every email sent TO or received
 * FROM this landlord by ANY agent in the organization.
 *
 * Primary strategy: filter by landlord_id (set by sendLandlordEmail on outbound and
 * by handleGmailWebhook on inbound replies). This is reliable and doesn't depend on
 * email address formatting.
 *
 * Fallback: for older emails without landlord_id, also fetch a recent batch and
 * substring-match by the landlord's email addresses (primary + additional).
 *
 * @param {string|string[]} emails — primary email, or array of [primary, ...additional]
 * @param {string} landlordId — the landlord's entity id (preferred lookup key)
 */
export function useLandlordEmails(emails, landlordId) {
  const queryClient = useQueryClient();
  const emailList = (Array.isArray(emails) ? emails : [emails])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  const key = (landlordId || '') + '|' + emailList.join('|');

  const { data = [] } = useQuery({
    queryKey: ['landlord_emails', key],
    queryFn: async () => {
      // Primary: filter by landlord_id (reliable — set on both outbound and inbound).
      let primary = [];
      if (landlordId) {
        primary = await base44.entities.Email.filter({ landlord_id: landlordId }, '-received_at', 200).catch(() => []);
      }

      // Fallback: for legacy emails without landlord_id, substring-match by email address.
      // Only needed if the landlord_id query returned nothing OR to catch old records.
      let fallback = [];
      if (emailList.length && primary.length < 200) {
        const batch = await base44.entities.Email.list('-received_at', 500).catch(() => []);
        if (batch && batch.length) {
          fallback = batch.filter((e) => {
            // Skip emails already in the primary set (dedup by id).
            if (primary.some(p => p.id === e.id)) return false;
            const to = String(e.to || '').toLowerCase();
            const from = String(e.from_email || '').toLowerCase();
            return emailList.some((em) => to.includes(em) || from === em);
          });
        }
      }

      // Merge + dedup by id, sort by received_at descending.
      const merged = [...primary, ...fallback];
      const seen = new Set();
      const deduped = merged.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      return deduped.sort((a, b) => {
        const ta = new Date(a.received_at || a.created_date || 0).getTime();
        const tb = new Date(b.received_at || b.created_date || 0).getTime();
        return tb - ta;
      });
    },
    enabled: emailList.length > 0 || !!landlordId,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!emailList.length && !landlordId) return;
    let unsubscribe = () => {};
    try {
      const unsub = base44.entities.Email.subscribe?.(() => {
        queryClient.invalidateQueries({ queryKey: ['landlord_emails'] });
      });
      if (typeof unsub === 'function') unsubscribe = unsub;
    } catch (_) { /* realtime unavailable — fall back to polling interval */ }
    return () => { try { unsubscribe(); } catch (_) {} };
  }, [key]);

  return { data };
}