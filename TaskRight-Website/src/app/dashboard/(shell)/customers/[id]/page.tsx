import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession, businessGet } from '@/lib/serverApi';
import { type GeocodeStatus, formatMoney, formatPhone, frequencyLabel } from '@/lib/customers';
import { LIFECYCLE_CLASS, LIFECYCLE_LABEL, type LifecycleState, dayKey, formatLongDay } from '@/lib/schedule';
import ContactCard from '@/components/dashboard/customers/ContactCard';
import DeleteButton from '@/components/dashboard/DeleteButton';
import CustomerMap from '@/components/dashboard/customers/CustomerMapLazy';

type CustomerDetail = {
  id: number;
  name: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  reviewRequestsOptedOut: boolean;
  geocodeStatus: GeocodeStatus;
  lat: number | null;
  lng: number | null;
  assignedCycles: { id: number; serviceCycleName: string; frequency: string; totalHours: number | null; pricePerVisit: string | number | null }[];
  upcomingServices: { id: number; serviceCycleName: string | null; serviceDate: string; lifecycleState: LifecycleState }[];
};

type Profitability = {
  totalRevenue: number;
  totalCost: number;
  totalMarginDollars: number;
  totalMarginPercent: number | null;
  completedJobCount: number;
};

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-text font-semibold text-base">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const session = await requireSession();

  const [customerRes, profitRes] = await Promise.all([
    businessGet<{ customer: CustomerDetail }>(session, `/customers/${id}`),
    businessGet<{ profitability: Profitability }>(session, `/customers/${id}/profitability`),
  ]);
  if (!customerRes) notFound();
  const c = customerRes.customer;
  const p = profitRes?.profitability;
  const base = `/dashboard/customers/${c.id}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/customers" className="text-text-muted text-sm hover:text-text">‹ All customers</Link>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
          <div>
            <h2 className="text-xl font-bold text-text">{c.name}</h2>
            <p className="text-text-muted text-sm">{formatPhone(c.phoneNumber)}</p>
          </div>
          <Link
            href={`/dashboard/messages?customer=${c.id}`}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text font-medium hover:bg-bg"
          >
            Message
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          <Card
            title="Services"
            right={<Link href={`${base}/services/new`} className="text-brand text-sm font-medium hover:underline">+ Add service</Link>}
          >
            {c.assignedCycles.length === 0 ? (
              <div className="rounded-xl bg-bg p-4">
                <p className="text-text text-sm font-medium">No services yet</p>
                <p className="text-text-muted text-xs mt-0.5">Add a service to start scheduling visits — they’ll land on your Schedule automatically.</p>
              </div>
            ) : (
              <div>
                {c.assignedCycles.map(s => (
                  <Link
                    key={s.id}
                    href={`${base}/services/${s.id}`}
                    className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0 hover:bg-bg -mx-2 px-2 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-text text-sm font-medium truncate">{s.serviceCycleName}</p>
                      <p className="text-text-muted text-xs">
                        {frequencyLabel(s.frequency)}{s.totalHours != null ? ` · ${s.totalHours} hrs` : ''}
                      </p>
                    </div>
                    <span className="text-text text-sm shrink-0">
                      {s.pricePerVisit != null ? `${formatMoney(Number(s.pricePerVisit))}/visit` : <span className="text-text-muted">No price</span>}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Upcoming service calls">
            {c.upcomingServices.length === 0 ? (
              <p className="text-text-muted text-sm">No upcoming calls.</p>
            ) : (
              <div>
                {c.upcomingServices.map(u => (
                  <Link
                    key={u.id}
                    href={`/dashboard/schedule/calls/${u.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0 hover:bg-bg -mx-2 px-2 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-text text-sm font-medium">{formatLongDay(dayKey(u.serviceDate))}</p>
                      <p className="text-text-muted text-xs truncate">{u.serviceCycleName || 'Service'} · Ref #{u.id}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${LIFECYCLE_CLASS[u.lifecycleState]}`}>
                      {LIFECYCLE_LABEL[u.lifecycleState]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Profitability" right={p ? <span className="text-text-muted text-xs">{p.completedJobCount} completed job{p.completedJobCount === 1 ? '' : 's'}</span> : undefined}>
            {!p || p.completedJobCount === 0 ? (
              <p className="text-text-muted text-sm">Revenue, cost and margin appear here once this customer’s first job is completed.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-text-muted text-xs mb-0.5">Revenue</p>
                  <p className="text-text text-base font-semibold">{formatMoney(p.totalRevenue)}</p>
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-text-muted text-xs mb-0.5">Cost</p>
                  <p className="text-text text-base font-semibold">{formatMoney(p.totalCost)}</p>
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-text-muted text-xs mb-0.5">Margin</p>
                  <p className={`text-base font-semibold ${p.totalMarginDollars < 0 ? 'text-red-600' : 'text-text'}`}>
                    {formatMoney(p.totalMarginDollars)}
                    {p.totalMarginPercent != null && <span className="text-text-muted text-xs font-normal"> · {p.totalMarginPercent}%</span>}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <ContactCard
            businessId={session.businessId}
            customerId={c.id}
            email={c.email}
            address={c.address}
            notes={c.notes}
            reviewRequestsOptedOut={!!c.reviewRequestsOptedOut}
            geocodeStatus={c.geocodeStatus}
          />
          {c.lat != null && c.lng != null && (
            <CustomerMap pins={[{ id: c.id, name: c.name, address: c.address, lat: c.lat, lng: c.lng, today: false }]} height={240} />
          )}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-text font-semibold text-base mb-3">Delete customer</h3>
            <DeleteButton
              path={`/${session.businessId}/customers/${c.id}`}
              label="Delete customer"
              warning={`Permanently deletes ${c.name}, their services, every service call (including completed ones and their job costs), selections and reviews. Message history is kept. This can’t be undone.`}
              redirectTo="/dashboard/customers"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
