/**
 * Normalize phone numbers to E.164 format for deduplication
 * Handles UAE numbers and various formats
 */

export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + if present (we'll add it back)
  cleaned = cleaned.replace(/^\+/, '');
  
  // Remove international prefix (00)
  cleaned = cleaned.replace(/^00/, '');
  
  // For UAE numbers: ensure +971 prefix
  if (cleaned.startsWith('971')) {
    // Already has country code
    return '+' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length > 8) {
    // Local UAE number starting with 0 (e.g., 058...)
    return '+971' + cleaned.slice(1);
  } else if (cleaned.length === 9) {
    // 9-digit UAE mobile (e.g., 581806000)
    return '+971' + cleaned;
  }
  
  // For other countries, just ensure + prefix
  return '+' + cleaned;
}

/**
 * Format phone number for display
 * Shows in a readable format: +971 58 180 6000
 */
export function formatPhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  
  // Remove + for formatting
  const digits = normalized.replace(/\D/g, '');
  
  if (digits.startsWith('971') && digits.length === 12) {
    // UAE format: +971 58 180 6000
    return `+971 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  
  // Default: just return with +
  return normalized;
}

/**
 * Check if two phone numbers match after normalization
 */
export function phoneNumbersMatch(phone1, phone2) {
  if (!phone1 || !phone2) return false;
  return normalizePhoneNumber(phone1) === normalizePhoneNumber(phone2);
}