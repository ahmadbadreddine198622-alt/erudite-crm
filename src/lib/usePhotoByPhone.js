import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Normalize phone for matching: strip +, spaces, dashes, parentheses, leading zeros; key on last 9-12 digits
function normalizePhone(phone) {
  if (!phone) return '';
  const stripped = phone.replace(/[\s+\-()]/g, '');
  const noLeadingZeros = stripped.replace(/^0+/, '');
  return noLeadingZeros.slice(-12);
}

/**
 * Hook to load WhatsApp profile photos and match by phone number.
 * Loads once on mount, builds an in-memory map, exposes getPhotoForPhone(phone).
 * Filters out Google Drive URLs (dead links) — those fall back to letter circles.
 * Reusable across Pipeline, Landlords, Contacts pages.
 */
export function usePhotoByPhone() {
  const [photoMap, setPhotoMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Fetch only conversations with non-null wa_profile_pic_url
        const conversations = await base44.entities.WhatsAppConversation.filter(
          { wa_profile_pic_url: { $ne: null } },
          null,
          2000 // Fetch up to 2000 records
        );

        if (!mounted) return;

        // Build map: normalizedPhone -> wa_profile_pic_url
        const map = {};
        for (const conv of conversations) {
          const url = conv.wa_profile_pic_url;
          
          // Skip Google Drive URLs (dead links from old re-hosting attempt)
          if (!url || url.includes('drive.google.com')) continue;

          // Index by both wa_phone_e164 and phone_number (they're usually the same)
          const phones = [conv.wa_phone_e164, conv.phone_number].filter(Boolean);
          for (const phone of phones) {
            const normalized = normalizePhone(phone);
            if (normalized) {
              map[normalized] = url;
            }
          }
        }

        // Also index photos synced directly onto Landlord records —
        // syncPeninsulaProfilePics writes Landlord.wa_profile_pic_url; cold owners
        // with no WhatsAppConversation would otherwise never show a photo on cards.
        try {
          const landlords = await base44.entities.Landlord.filter(
            { wa_profile_pic_url: { $nin: [null, 'no_photo'] } },
            null,
            2000
          );
          if (!mounted) return;
          for (const l of landlords) {
            const url = l.wa_profile_pic_url;
            if (!url || url === 'no_photo' || url.includes('drive.google.com')) continue;
            const phones = [l.phone, l.whatsapp].filter(Boolean);
            for (const phone of phones) {
              const normalized = normalizePhone(phone);
              if (normalized) map[normalized] = url; // landlord-synced pic wins — deliberate, freshest
            }
          }
        } catch (e) {
          console.warn('Failed to load landlord profile photos:', e);
        }

        setPhotoMap(map);
      } catch (err) {
        // Silent fail — all cards will fall back to letter circles
        console.warn('Failed to load WhatsApp profile photos:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const getPhotoForPhone = useCallback((phone) => {
    if (!phone) return null;
    const normalized = normalizePhone(phone);
    return photoMap[normalized] || null;
  }, [photoMap]);

  return { getPhotoForPhone, isLoading };
}