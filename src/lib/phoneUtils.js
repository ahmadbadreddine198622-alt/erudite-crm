/**
 * Normalize phone number to international format
 * Removes symbols, spaces, and ensures E.164 format (+country code number)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  
  // Handle UAE numbers (leading 0 or without)
  if (cleaned.startsWith('971') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0') && cleaned.length === 10 && cleaned.substring(1).startsWith('5')) {
    return `+971${cleaned.substring(1)}`;
  }
  
  // Already in E.164 format
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }
  
  return null;
}

/**
 * Extract phone number from various formats
 */
export function extractPhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  return normalized ? normalized.replace('+', '') : null;
}

/**
 * Check if two phone numbers match
 */
export function phonesMatch(phone1, phone2) {
  const norm1 = normalizePhoneNumber(phone1);
  const norm2 = normalizePhoneNumber(phone2);
  return norm1 && norm2 && norm1 === norm2;
}