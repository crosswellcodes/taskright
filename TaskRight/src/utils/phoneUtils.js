/**
 * Strip non-digits and normalize to E.164 format.
 * Automatically prepends US country code 1 for 10-digit numbers.
 * e.g. "4028675309"      → "+14028675309"
 * e.g. "(402) 867-5309"  → "+14028675309"
 * e.g. "14028675309"     → "+14028675309"
 * e.g. "1 (402) 867-5309" → "+14028675309"
 */
export const normalizePhone = (raw) => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
};

/**
 * Format a stored E.164 phone number for display.
 * e.g. "+13330001111" → "(333) 000-1111"
 * Falls back to the raw value for non-standard numbers.
 */
export const formatPhone = (raw) => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Strip leading country code 1 if 11 digits (US)
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};

/**
 * Strip the leading + for editable input fields so users see clean digits.
 * e.g. "+13330001111" → "13330001111"
 */
export const displayPhone = (stored) => (stored ? stored.replace(/^\+/, '') : '');
