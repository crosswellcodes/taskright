// Shared Schedule-module types + date helpers. All dates are plain YYYY-MM-DD
// strings; math is done in UTC so the server's timezone never shifts a day.
// "Today" and clock times are the BUSINESS's zone (GET /businesses/:id
// timeZone), never the server's — on Vercel that's UTC. See WEB_PORTAL.md
// "Time zones".

export type LifecycleState = 'proposed' | 'confirmed' | 'completed';

export type ForecastEntry = { id: number; name: string; selectionCycleId: number; lifecycleState: LifecycleState };

export type ForecastDay = {
  serviceDate: string;
  customerSelectionsStatus: { submitted: number; pending: number };
  totalHours: number;
  serviceCycles: { id: number; name: string | null; pendingCustomers: ForecastEntry[]; submittedCustomers: ForecastEntry[] }[];
};

export type Forecast = { totalCustomers: number; upcomingServices: ForecastDay[] };

export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  proposed: 'Proposed',
  confirmed: 'Confirmed',
  completed: 'Completed',
};

export const LIFECYCLE_CLASS: Record<LifecycleState, string> = {
  proposed: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-brand/10 text-brand',
  completed: 'bg-green-100 text-green-700',
};

export const LIFECYCLE_DOT: Record<LifecycleState, string> = {
  proposed: 'bg-amber-400',
  confirmed: 'bg-brand',
  completed: 'bg-success',
};

// Postgres date columns arrive as ISO strings — always split on 'T'.
export const dayKey = (s: string) => String(s).split('T')[0];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export const isDateKey = (s?: string): s is string => !!s && DATE_RE.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`));
export const isMonthKey = (s?: string): s is string => !!s && MONTH_RE.test(s) && Number(s.slice(5)) >= 1 && Number(s.slice(5)) <= 12;

const toKey = (d: Date) => d.toISOString().split('T')[0];

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
}

export function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toKey(d).slice(0, 7);
}

// The 6-week (42-day) Sunday-start grid covering a month — also the forecast
// range requested from the backend (well under its 62-day cap).
export function monthGrid(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const start = addDays(`${month}-01`, -first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return { days, from: days[0], to: days[41] };
}

export function formatMonth(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatLongDay(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// Every Call on a forecast day, flattened.
export function callsForDay(day: ForecastDay) {
  return day.serviceCycles.flatMap(svc =>
    [...svc.pendingCustomers, ...svc.submittedCustomers].map(e => ({ ...e, serviceName: svc.name })),
  );
}

export const DEFAULT_TIME_ZONE = 'America/Chicago';

// Calendar date (YYYY-MM-DD) of an instant in the business's zone; en-CA
// formats as ISO year-month-day.
export function dateKeyIn(timeZone: string, at: Date | string = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

export function todayKey(timeZone: string) {
  return dateKeyIn(timeZone);
}

// "3:45 PM" for an ISO timestamp, in the business's zone.
export function formatTimeIn(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
}

// "Oct 14, 2026, 3:45 PM" for an ISO timestamp, in the business's zone.
export function formatDateTimeIn(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone });
}
