'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Re-runs the Server Component page every `ms` while the tab is visible —
// keeps live boards (e.g. who's on the clock) current without a socket.
export default function AutoRefresh({ ms = 30000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
