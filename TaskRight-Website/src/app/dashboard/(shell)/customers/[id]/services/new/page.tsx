import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession, businessGet } from '@/lib/serverApi';
import ServiceForm from '@/components/dashboard/customers/ServiceForm';

type Template = { id: number; name: string; frequency: string; daysBeforeServiceDeadline: number | null; tasks: { name: string; timeAllotmentMinutes: number }[] };

export default async function NewServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const session = await requireSession();

  const [customerRes, businessRes, templatesRes, membersRes, groupsRes] = await Promise.all([
    businessGet<{ customer: { id: number; name: string } }>(session, `/customers/${id}`),
    businessGet<{ business: { schedulingFormat: 'date_based' | 'day_of_week' } }>(session, ''),
    businessGet<{ serviceTemplates: Template[] }>(session, '/service-templates'),
    businessGet<{ teamMembers: { id: number; name: string }[] }>(session, '/team-members'),
    businessGet<{ groups: { id: number; name: string }[] }>(session, '/groups'),
  ]);
  if (!customerRes) notFound();
  const customer = customerRes.customer;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/dashboard/customers/${customer.id}`} className="text-text-muted text-sm hover:text-text">‹ {customer.name}</Link>
        <h2 className="text-xl font-bold text-text mt-2">New service for {customer.name}</h2>
      </div>
      <ServiceForm
        businessId={session.businessId}
        customerId={customer.id}
        customerName={customer.name}
        schedulingFormat={businessRes?.business.schedulingFormat ?? 'date_based'}
        templates={templatesRes?.serviceTemplates ?? []}
        members={membersRes?.teamMembers ?? []}
        groups={groupsRes?.groups ?? []}
      />
    </div>
  );
}
