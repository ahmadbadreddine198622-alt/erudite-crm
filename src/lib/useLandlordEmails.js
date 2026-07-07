import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Fetches the SHARED email stream for a landlord — every email sent TO or received
 * FROM this landlord by ANY agent in the organization (the Email entity has no RLS,
 * so all users see all emails). Matching is substring-based because the stored `to`
 * field is a comma-separated list of recipients (e.g. "a@x.com, b@x.com"), which
 * breaks exact-match queries. We fetch a recent batch and filter client-side across
 * the landlord's primary + additional email addresses.
 *
 * @param {string|string[]} emails — primary email, or array of [primary, ...additional]
 */
export function useLandlordEmails(emails) {
  const queryClient = useQueryClient();
  const emailList = (Array.isArray(emails) ? emails : [emails])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  const key = emailList.join('|');

  const { data = [] } = useQuery({
    queryKey: ['landlord_emails', key],
    queryFn: async () => {
      if (!emailList.length) return [];
      // Email has no RLS → user-scoped list returns the whole org's emails.
      // Fetch a generous recent batch and filter for this landlord's addresses.
      const batch = await base44.entities.Email.list('-received_at', 500).catch(() => []);
      if (!batch || !batch.length) return [];
      return batch.filter((e) => {
        const to = String(e.to || '').toLowerCase();
        const from = String(e.from_email || '').toLowerCase();
        return emailList.some((em) => to.includes(em) || from === em);
      });
    },
    enabled: emailList.length > 0,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!emailList.length) return;
    // Realtime may be unavailable on this plan (no live socket) — guard so a
    // missing/throwing subscribe() never crashes the whole LandlordDetailPage.
    let unsubscribe = () => {};
    try {
      const unsub = base44.entities.Email.subscribe?.(() => {
        queryClient.invalidateQueries({ queryKey: ['landlord_emails', key] });
      });
      if (typeof unsub === 'function') unsubscribe = unsub;
    } catch (_) { /* realtime unavailable — fall back to polling interval */ }
    return () => { try { unsubscribe(); } catch (_) {} };
  }, [key]);

  return { data };
}