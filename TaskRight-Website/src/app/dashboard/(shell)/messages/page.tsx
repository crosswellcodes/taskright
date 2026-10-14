import ModuleStub from '@/components/dashboard/ModuleStub';

export default function MessagesPage() {
  return (
    <ModuleStub
      title="Messages"
      description="A desktop comms console for every customer thread."
      comingSoon={[
        'A unified SMS inbox across all customers, with unread badges',
        'Thread view with photo/MMS media',
        'Compose and reply from your desktop',
      ]}
    />
  );
}
