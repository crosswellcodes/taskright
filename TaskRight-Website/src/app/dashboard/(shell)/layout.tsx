import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import DashboardShell from '@/components/dashboard/DashboardShell';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/dashboard/login');

  const res = await fetch(`${API_BASE}/api/businesses/${session.businessId}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });

  if (!res.ok) redirect('/dashboard/login');
  const { business } = await res.json();

  return <DashboardShell business={business}>{children}</DashboardShell>;
}
