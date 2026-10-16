import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession, businessGet, getBusiness } from '@/lib/serverApi';
import { todayKey } from '@/lib/schedule';
import ServiceForm, { type ServiceDefinition } from '@/components/dashboard/customers/ServiceForm';
import DeleteButton from '@/components/dashboard/DeleteButton';

export default async function EditServicePage({ params }: { params: Promise<{ id: string; serviceId: string }> }) {
  const { id, serviceId } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(serviceId)) notFound();
  const session = await requireSession();

  const [customerRes, serviceRes, business] = await Promise.all([
    businessGet<{ customer: { id: number; name: string } }>(session, `/customers/${id}`),
    businessGet<{ service: ServiceDefinition & { customerId: number } }>(session, `/customers/${id}/services/${serviceId}`),
    getBusiness(session),
  ]);
  // The service lookup is business-scoped; also require it to be this customer's.
  if (!customerRes || !serviceRes || serviceRes.service.customerId !== customerRes.customer.id) notFound();
  const customer = customerRes.customer;
  const service = serviceRes.service;
  const servicePath = `/${session.businessId}/customers/${customer.id}/services/${service.id}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/dashboard/customers/${customer.id}`} className="text-text-muted text-sm hover:text-text">‹ {customer.name}</Link>
        <h2 className="text-xl font-bold text-text mt-2">Edit {service.name}</h2>
      </div>
      <ServiceForm
        businessId={session.businessId}
        customerId={customer.id}
        customerName={customer.name}
        schedulingFormat={business.schedulingFormat === 'day_of_week' ? 'day_of_week' : 'date_based'}
        today={todayKey(business.timeZone)}
        service={service}
      />
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-text font-semibold text-base mb-3">Delete service</h3>
        <DeleteButton
          path={servicePath}
          label="Delete service"
          warning="Removes this service and its upcoming visits. Services with completed visits can’t be deleted (their job history is kept)."
          redirectTo={`/dashboard/customers/${customer.id}`}
        />
      </div>
    </div>
  );
}
