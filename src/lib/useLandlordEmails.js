import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

function dedupeById(batches) {
  const seen = new Set();
  const out = [];
  for (const batch of batches) {
    if (!batch) continue;
    for (const row of batch) {
      if (row && !seen.has(row.id)) { seen.add(row.id); out.push(row); }
    }
  }
  return out;
}

/**
 * Fetches the email stream for a landlord (matched by from_email OR to) and keeps it
 * live in real time: a subscription to the Email entity invalidates the query the moment
 * ANY agent sends or receives an email touching this landlord's address — so the Email
 * tab updates for every viewer immediately, not only the sender.
 */
export function useLandlordEmails(landlordEmail) {
  const queryClient = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ['landlord_emails', landlordEmail],
    queryFn: async () => {
      if (!landlordEmail) return [];
      const [fromB, toB] = await Promise.all([
        base44.entities.Email.filter({ from_email: landlordEmail }, '-received_at', 100).catch(() => []),
        base44.entities.Email.filter({ to: landlordEmail }, '-received_at', 100).catch(() => []),
      ]);
      return dedupeById([fromB, toB]);
    },
    enabled: !!landlordEmail,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!landlordEmail) return;
    const unsubscribe = base44.entities.Email.subscribe((event) => {
      if (event.type !== 'create') return;
      const d = event.data || {};
      if (d.from_email === landlordEmail || d.to === landlordEmail) {
        queryClient.invalidateQueries({ queryKey: ['landlord_emails', landlordEmail] });
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [landlordEmail]);

  return { data };
}