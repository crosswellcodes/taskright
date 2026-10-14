'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DASHBOARD_NAV } from '@/lib/navigation';
import LogoutButton from './LogoutButton';

type Business = { id: number; name: string };

export default function DashboardShell({
  business,
  children,
}: {
  business: Business;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const initial = business.name.trim().charAt(0).toUpperCase() || 'B';

  return (
    <div className="min-h-screen bg-bg flex flex-col lg:flex-row">
      {/* Top bar (mobile) */}
      <header className="lg:hidden bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text"
        >
          {navOpen ? '✕' : '☰'}
        </button>
        <span className="text-brand font-bold text-lg tracking-tight">TaskRight</span>
        <div className="w-8 h-8 rounded-full bg-brand/10 text-brand text-sm font-semibold flex items-center justify-center">
          {initial}
        </div>
      </header>

      {/* Left nav */}
      <nav
        className={`${navOpen ? 'block' : 'hidden'} lg:block w-full lg:w-64 bg-white border-r border-border lg:min-h-screen lg:sticky lg:top-0`}
      >
        <div className="hidden lg:block px-6 py-5 border-b border-border">
          <Link href="/dashboard" className="text-brand font-bold text-xl tracking-tight">
            TaskRight
          </Link>
        </div>
        <div className="lg:hidden px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-text font-semibold text-sm">{business.name}</span>
          <LogoutButton />
        </div>
        <ul className="px-3 py-4 space-y-1">
          {DASHBOARD_NAV.map((item) => {
            const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    active ? 'bg-brand/10 text-brand' : 'text-text-muted hover:bg-bg hover:text-text'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (desktop) */}
        <header className="hidden lg:flex bg-white border-b border-border px-8 py-4 items-center justify-between">
          <h1 className="text-text font-semibold text-base">{business.name}</h1>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-brand/10 text-brand text-sm font-semibold flex items-center justify-center">
              {initial}
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
