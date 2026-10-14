import ModuleStub from '@/components/dashboard/ModuleStub';

export default function TeamPage() {
  return (
    <ModuleStub
      title="Team"
      description="Manage your crew and see who's working."
      comingSoon={[
        'Team members — hourly rate, invite codes',
        'Groups and assignments',
        'A live on-the-clock board with location',
        'Utilization and per-member job history',
      ]}
    />
  );
}
