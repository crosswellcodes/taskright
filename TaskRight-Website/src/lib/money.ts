// Shared Money-module types + period helpers (WEB_PORTAL M6).
import { addDays, todayKey } from '@/lib/schedule';

export type Margin = { marginDollars: number; marginPercent: number | null };

export type ProfitJob = {
  selectionCycleId: number;
  serviceDate: string;
  customerId: number;
  customerName: string;
  serviceId: number | null;
  serviceName: string | null;
  price: number | null;
  laborCost: number;
  materialsCost: number;
  overheadCost: number;
  totalCost: number;
  marginDollars: number | null;
  marginPercent: number | null;
  hasManualEdits: boolean;
};

export type Profitability = {
  range: { from: string; to: string };
  totals: Margin & {
    revenue: number; laborCost: number; materialsCost: number; overheadCost: number; totalCost: number;
    completedJobCount: number; unpricedJobCount: number;
  };
  byCategory: { code: number; name: string; type: string; amount: number }[];
  byCustomer: (Margin & { customerId: number; customerName: string; revenue: number; totalCost: number; jobs: number })[];
  byService: (Margin & { serviceId: number; serviceName: string; customerId: number; customerName: string; revenue: number; totalCost: number; jobs: number })[];
  jobs: ProfitJob[];
  pipeline: { openJobCount: number; expectedRevenue: number };
};

export const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
] as const;
export type Period = (typeof PERIODS)[number]['value'];

// Inclusive YYYY-MM-DD range for a period, in the viewer's calendar.
export function periodRange(period: Period) {
  const today = todayKey();
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate(); // mm is 1-based
  switch (period) {
    case 'last-month': {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(lastDay(ly, lm))}` };
    }
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    default:
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
  }
}

export function formatPercent(n: number | null) {
  return n == null ? '—' : `${n}%`;
}
