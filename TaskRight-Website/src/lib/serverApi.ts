import { redirect } from 'next/navigation';
import { getSession, type Session } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Server Component reads: fetch a backend /api/businesses/:id/* path with the
// session's bearer (the same direct-fetch pattern the Home page and shell layout
// use). 401 → back to login; 404 → null so the page can render notFound().
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/dashboard/login');
  return session;
}

export async function businessGet<T>(session: Session, path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}/api/businesses/${session.businessId}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) redirect('/dashboard/login');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend ${res.status} on ${path}`);
  return res.json();
}
