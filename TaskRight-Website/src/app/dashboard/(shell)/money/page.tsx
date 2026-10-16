import Link from 'next/link';
import { requireSession, businessGet, getTimeZone } from '@/lib/serverApi';
import { formatMoney } from '@/lib/customers';
import { formatLongDay } from '@/lib/schedule';
import { type Period, type Profitability, PERIODS, formatPercent, periodRange } from '@/lib/money';

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'neg' | 'muted' }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'neg' ? 'text-red-600' : tone === 'muted' ? 'text-text-muted' : 'text-text'}`}>{value}</p>
      {sub && <p className="text-text-muted text-xs mt-1">{sub}</p>}
    </div>
  );
}

const marginClass = (n: number | null) => (n != null && n < 0 ? 'text-red-600' : 'text-text');

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireSession();
  const { period: periodParam } = await searchParams;
  const period: Period = PERIODS.some(p => p.value === periodParam) ? (periodParam as Period) : 'month';
  const { from, to } = periodRange(period, await getTimeZone(session));

  const res = await businessGet<{ profitability: Profitability }>(session, `/profitability?from=${from}&to=${to}`);
  const p = res?.profitability;
  if (!p) return null;
  const t = p.totals;
  const statementCosts = p.byCategory.filter(c => c.type !== 'revenue');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text mb-1">Money</h2>
          <p className="text-text-muted text-sm">True job cost and margin — {formatLongDay(from)} to {formatLongDay(to)}.</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-white border border-border rounded-lg p-1">
          {PERIODS.map(opt => (
            <Link
              key={opt.value}
              href={opt.value === 'month' ? '/dashboard/money' : `/dashboard/money?period=${opt.value}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === opt.value ? 'bg-brand text-white' : 'text-text hover:bg-bg'}`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Revenue" value={formatMoney(t.revenue)} sub={`${t.completedJobCount} completed job${t.completedJobCount === 1 ? '' : 's'}`} />
        <Tile label="Total cost" value={formatMoney(t.totalCost)} sub="Labor + materials + overhead" />
        <Tile label="Margin" value={formatMoney(t.marginDollars)} sub={formatPercent(t.marginPercent)} tone={t.marginDollars < 0 ? 'neg' : undefined} />
        <Tile
          label="Still scheduled"
          value={formatMoney(p.pipeline.expectedRevenue)}
          sub={`${p.pipeline.openJobCount} open call${p.pipeline.openJobCount === 1 ? '' : 's'} in this period`}
          tone="muted"
        />
      </div>

      {t.unpricedJobCount > 0 && (
        <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          {t.unpricedJobCount} completed job{t.unpricedJobCount === 1 ? ' has' : 's have'} no price, so {t.unpricedJobCount === 1 ? 'it counts' : 'they count'} as $0 revenue while {t.unpricedJobCount === 1 ? 'its' : 'their'} costs still count.
          Set a price from the job below.
        </p>
      )}

      {t.completedJobCount === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-6">
          <p className="text-text text-sm font-medium">No completed jobs in this period</p>
          <p className="text-text-muted text-xs mt-1">
            As jobs are completed, revenue comes from each call’s price and costs from on-site time (auto-tracked labor at each member’s rate) plus any materials and overhead you add.
            Margin by customer, by service and per job shows up here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            <div className="bg-white rounded-2xl border border-border p-6">
              <h3 className="text-text font-semibold text-base mb-4">Statement</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 text-text-muted tabular-nums w-14">4000</td>
                    <td className="py-2 text-text font-medium">Service Revenue</td>
                    <td className="py-2 text-right tabular-nums text-text font-medium">{formatMoney(t.revenue)}</td>
                  </tr>
                  {statementCosts.map(c => (
                    <tr key={c.code} className="border-b border-border">
                      <td className="py-2 text-text-muted tabular-nums">{c.code}</td>
                      <td className="py-2 text-text">{c.name}</td>
                      <td className="py-2 text-right tabular-nums text-text">({formatMoney(c.amount)})</td>
                    </tr>
                  ))}
                  <tr>
                    <td />
                    <td className="pt-3 text-text font-semibold">Gross margin</td>
                    <td className={`pt-3 text-right tabular-nums font-semibold ${marginClass(t.marginDollars)}`}>
                      {formatMoney(t.marginDollars)}
                      <span className="block text-text-muted text-xs font-normal">{formatPercent(t.marginPercent)}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-border p-6 overflow-x-auto">
              <h3 className="text-text font-semibold text-base mb-4">By customer</h3>
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-text-muted text-xs text-left border-b border-border">
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium text-right">Jobs</th>
                    <th className="pb-2 font-medium text-right">Revenue</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                    <th className="pb-2 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {p.byCustomer.map(c => (
                    <tr key={c.customerId} className="border-b border-border last:border-0">
                      <td className="py-2"><Link href={`/dashboard/customers/${c.customerId}`} className="text-text hover:text-brand">{c.customerName}</Link></td>
                      <td className="py-2 text-right tabular-nums text-text-muted">{c.jobs}</td>
                      <td className="py-2 text-right tabular-nums text-text">{formatMoney(c.revenue)}</td>
                      <td className="py-2 text-right tabular-nums text-text">{formatMoney(c.totalCost)}</td>
                      <td className={`py-2 text-right tabular-nums font-medium ${marginClass(c.marginDollars)}`}>
                        {formatMoney(c.marginDollars)} <span className="text-text-muted text-xs font-normal">{formatPercent(c.marginPercent)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-6 overflow-x-auto">
            <h3 className="text-text font-semibold text-base mb-4">By service</h3>
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-text-muted text-xs text-left border-b border-border">
                  <th className="pb-2 font-medium">Service</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium text-right">Jobs</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                  <th className="pb-2 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {p.byService.map(s => (
                  <tr key={s.serviceId} className="border-b border-border last:border-0">
                    <td className="py-2 text-text">
                      <Link href={`/dashboard/customers/${s.customerId}/services/${s.serviceId}`} className="hover:text-brand">{s.serviceName}</Link>
                    </td>
                    <td className="py-2 text-text-muted">{s.customerName}</td>
                    <td className="py-2 text-right tabular-nums text-text-muted">{s.jobs}</td>
                    <td className="py-2 text-right tabular-nums text-text">{formatMoney(s.revenue)}</td>
                    <td className="py-2 text-right tabular-nums text-text">{formatMoney(s.totalCost)}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${marginClass(s.marginDollars)}`}>
                      {formatMoney(s.marginDollars)} <span className="text-text-muted text-xs font-normal">{formatPercent(s.marginPercent)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-border p-6 overflow-x-auto">
            <h3 className="text-text font-semibold text-base mb-1">Jobs</h3>
            <p className="text-text-muted text-xs mb-4">Open a job to see its labor lines, edit its price, materials and overhead, and compare expected vs actual margin.</p>
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-text-muted text-xs text-left border-b border-border">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Customer · service</th>
                  <th className="pb-2 font-medium text-right">Price</th>
                  <th className="pb-2 font-medium text-right">Labor</th>
                  <th className="pb-2 font-medium text-right">Materials</th>
                  <th className="pb-2 font-medium text-right">Overhead</th>
                  <th className="pb-2 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {p.jobs.map(j => (
                  <tr key={j.selectionCycleId} className="border-b border-border last:border-0 hover:bg-bg">
                    <td className="py-2 text-text-muted whitespace-nowrap">
                      <Link href={`/dashboard/schedule/calls/${j.selectionCycleId}`} className="hover:text-brand">
                        {new Date(`${j.serviceDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                      </Link>
                    </td>
                    <td className="py-2">
                      <Link href={`/dashboard/schedule/calls/${j.selectionCycleId}`} className="text-text hover:text-brand">{j.customerName}</Link>
                      <span className="text-text-muted"> · {j.serviceName || 'Service'}</span>
                      {j.hasManualEdits && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-bg text-text-muted">edited</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{j.price == null ? <span className="text-amber-700">Not set</span> : formatMoney(j.price)}</td>
                    <td className="py-2 text-right tabular-nums text-text">{formatMoney(j.laborCost)}</td>
                    <td className="py-2 text-right tabular-nums text-text">{formatMoney(j.materialsCost)}</td>
                    <td className="py-2 text-right tabular-nums text-text">{formatMoney(j.overheadCost)}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${marginClass(j.marginDollars)}`}>
                      {j.marginDollars == null ? '—' : <>{formatMoney(j.marginDollars)} <span className="text-text-muted text-xs font-normal">{formatPercent(j.marginPercent)}</span></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
