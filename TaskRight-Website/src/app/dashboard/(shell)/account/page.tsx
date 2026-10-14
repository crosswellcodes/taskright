import ModuleStub from '@/components/dashboard/ModuleStub';

export default function AccountPage() {
  return (
    <ModuleStub
      title="Account & Billing"
      description="Your business profile, provisioning status, and early-access plan."
      comingSoon={[
        'Buy the lifetime early-access deal and see your receipt',
        'SMS number, brand, and campaign provisioning status',
        'Business profile — name, contact, address, entity type',
        'Your customer invite link and join code',
      ]}
    />
  );
}
