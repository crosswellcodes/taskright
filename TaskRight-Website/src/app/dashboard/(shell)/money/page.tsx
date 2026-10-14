import ModuleStub from '@/components/dashboard/ModuleStub';

export default function MoneyPage() {
  return (
    <ModuleStub
      title="Money"
      description="True job-cost and margin visibility — the differentiator."
      comingSoon={[
        'A profitability dashboard — overall, by customer, by service',
        'Job costs per call — labor, materials, overhead',
        'Expected-vs-actual margin',
        'A GAAP cost-category breakdown',
      ]}
    />
  );
}
