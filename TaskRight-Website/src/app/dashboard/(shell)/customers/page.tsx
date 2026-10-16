import { requireSession, businessGet, getTimeZone } from '@/lib/serverApi';
import { type Forecast, callsForDay, todayKey } from '@/lib/schedule';
import type { CustomerListItem } from '@/lib/customers';
import CustomersView from '@/components/dashboard/customers/CustomersView';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await requireSession();
  const { view } = await searchParams;
  const today = todayKey(await getTimeZone(session));

  const [customersRes, todayRes] = await Promise.all([
    businessGet<{ customers: CustomerListItem[] }>(session, '/customers'),
    businessGet<{ summary: Forecast }>(session, `/selections?from=${today}&to=${today}`),
  ]);

  // Customers with a Call today get highlighted on the list + map.
  const todayCustomerIds = (todayRes?.summary.upcomingServices ?? []).flatMap(d => callsForDay(d).map(c => c.id));

  return (
    <CustomersView
      businessId={session.businessId}
      customers={customersRes?.customers ?? []}
      todayCustomerIds={todayCustomerIds}
      view={view === 'map' ? 'map' : 'list'}
    />
  );
}
