// Shared Customers-module types + helpers (WEB_PORTAL M3). Mirrors the RN
// utils (phoneUtils.js, frequency.js) so web and app present data identically.

export type GeocodeStatus = 'none' | 'ok' | 'pending' | 'failed';

export type CustomerListItem = {
  id: number;
  name: string;
  phoneNumber: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  geocodeStatus: GeocodeStatus;
  assignedCycles: { id: number; name: string; frequency: string; totalHours: number | null }[];
};

export type MapPin = { id: number; name: string; address: string | null; lat: number; lng: number; today: boolean };

export const FREQUENCIES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export function frequencyLabel(value: string) {
  return FREQUENCIES.find(f => f.value === value)?.label ?? value;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "4028675309" / "(402) 867-5309" → "+14028675309" (same rule as the app).
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

// "+13330001111" → "(333) 000-1111"; non-US numbers pass through.
export function formatPhone(raw: string | null | undefined) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export function formatMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const GEOCODE_NOTE: Record<GeocodeStatus, string | null> = {
  none: 'No address on file — team members will clock in manually.',
  ok: null,
  pending: 'Locating this address on the map…',
  failed: 'We couldn’t map this address. Check it for typos so auto clock-in can work.',
};
