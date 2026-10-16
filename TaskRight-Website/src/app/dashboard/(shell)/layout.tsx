import { requireSession, getBusiness } from '@/lib/serverApi';
import DashboardShell from '@/components/dashboard/DashboardShell';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const business = await getBusiness(session);

  return <DashboardShell business={business}>{children}</DashboardShell>;
}
