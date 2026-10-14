import ModuleStub from '@/components/dashboard/ModuleStub';

export default function CustomersPage() {
  return (
    <ModuleStub
      title="Customers"
      description="Your CRM spine."
      comingSoon={[
        'A searchable customer list',
        'Customer detail — services, upcoming calls, profitability, messages',
        'A map view of your customers, with pins for today’s jobs',
        'Add and edit customers, services, and tasks',
      ]}
    />
  );
}
