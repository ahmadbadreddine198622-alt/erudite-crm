/**
 * Phone helpers — normalize, format, and identify phone numbers.
 *
 * All helpers default to UAE (AE) since this is a Dubai real-estate CRM,
 * but accept an override defaultCountry for international leads.
 */

const PREFIX_MAP = {
  "971": "AE", "966": "SA", "974": "QA", "973": "BH", "965": "KW",
  "968": "OM", "962": "JO", "961": "LB", "20": "EG", "44": "GB",
  "1": "US", "33": "FR", "49": "DE", "39": "IT", "34": "ES",
  "7": "RU", "86": "CN", "91": "IN", "92": "PK", "63": "PH",
  "90": "TR", "98": "IR"
};

/**
 * Normalize any phone format to E.164 ("+9715XXXXXXXX").
 *
 * Handles:
 *   - "+971 58 180 6000"  → "+971581806000"
 *   - "0581806000"        → "+971581806000"   (UAE local mobile)
 *   - "581806000"         → "+971581806000"   (UAE local mobile)
 *   - "00971581806000"    → "+971581806000"
 *   - "971581806000"      → "+971581806000"
 *
 * Returns null if the input cannot be parsed.
 */
export function normalizePhone(raw, defaultCountry = "AE") {
  if (!raw) return null;
  let cleaned = String(raw).replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) return cleaned;
  // Double-zero international prefix → +
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);

  // UAE-specific local-format handling (default)
  if (defaultCountry === "AE") {
    if (cleaned.startsWith('05') && cleaned.length === 10) return '+971' + cleaned.slice(1);
    if (cleaned.startsWith('5') && cleaned.length === 9) return '+971' + cleaned;
    if (cleaned.startsWith('971') && cleaned.length === 12) return '+' + cleaned;
  }

  // KSA-specific
  if (defaultCountry === "SA") {
    if (cleaned.startsWith('05') && cleaned.length === 10) return '+966' + cleaned.slice(1);
    if (cleaned.startsWith('5') && cleaned.length === 9) return '+966' + cleaned;
  }

  // Generic: long enough to be country code + number
  if (cleaned.length >= 10 && cleaned.length <= 15) return '+' + cleaned;
  return null;
}

/**
 * Format an E.164 number for display: "+971 58 180 6000".
 */
export function formatPhone(e164) {
  if (!e164) return '';
  const num = e164.replace(/^\+/, '');
  // UAE
  if (num.startsWith('971') && num.length === 12) {
    return `+971 ${num.slice(3, 5)} ${num.slice(5, 8)} ${num.slice(8)}`;
  }
  // KSA
  if (num.startsWith('966') && num.length === 12) {
    return `+966 ${num.slice(3, 5)} ${num.slice(5, 8)} ${num.slice(8)}`;
  }
  // US/CA
  if (num.startsWith('1') && num.length === 11) {
    return `+1 (${num.slice(1, 4)}) ${num.slice(4, 7)}-${num.slice(7)}`;
  }
  // UK
  if (num.startsWith('44') && num.length >= 12) {
    return `+44 ${num.slice(2, 6)} ${num.slice(6)}`;
  }
  // Generic: group last 9 digits in chunks of 3 from right
  if (num.length > 4) {
    const cc = num.slice(0, num.length - 9);
    const rest = num.slice(num.length - 9);
    return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  return e164;
}

export function isValidE164(s) {
  return /^\+[1-9]\d{7,14}$/.test(String(s || ''));
}

export function getCountryFromPhone(e164) {
  if (!e164) return null;
  const num = e164.replace(/^\+/, '');
  for (const len of [3, 2, 1]) {
    if (PREFIX_MAP[num.slice(0, len)]) return PREFIX_MAP[num.slice(0, len)];
  }
  return null;
}

export function countryFlag(cc) {
  if (!cc || cc.length !== 2) return null;
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  );
}

/**
 * Build a wa.me URL with optional prefilled message.
 * E.164 phones must have the leading + stripped for wa.me.
 */
export function waMeUrl(e164, prefilledMessage) {
  if (!e164) return null;
  const num = e164.replace(/^\+/, '');
  const params = prefilledMessage ? `?text=${encodeURIComponent(prefilledMessage)}` : '';
  return `https://wa.me/${num}${params}`;
}
