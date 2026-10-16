'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type InboxThread, formatInboxTime } from '@/lib/messages';
import { formatPhone } from '@/lib/customers';

type Props = {
  threads: InboxThread[];
  selectedId: number | null;
  customers: { id: number; name: string }[];
  timeZone: string;
};

// Left pane: every customer thread (latest first) with unread badges, search,
// and a "New message" picker that opens a thread with any customer.
export default function InboxList({ threads, selectedId, customers, timeZone }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    const digits = q.replace(/\D/g, '');
    return threads.filter(t =>
      t.customerName.toLowerCase().includes(q)
      || t.lastMessage.body.toLowerCase().includes(q)
      || (digits.length >= 3 && t.phoneNumber.replace(/\D/g, '').includes(digits)),
    );
  }, [threads, query]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-4 border-b border-border space-y-2">
        <select
          value=""
          onChange={e => e.target.value && router.push(`/dashboard/messages?customer=${e.target.value}`)}
          aria-label="Start a new message"
          className="w-full rounded-lg bg-brand text-white text-sm font-semibold px-3 py-2 cursor-pointer"
        >
          <option value="">+ New message…</option>
          {customers.map(c => <option key={c.id} value={c.id} className="text-text bg-white">{c.name}</option>)}
        </select>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-text text-sm font-medium">No conversations yet</p>
            <p className="text-text-muted text-xs mt-1">Every text with your customers lands here — reminders, replies, photos. Start one with “New message”.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-text-muted text-sm">No conversations match “{query}”.</p>
        ) : filtered.map(t => {
          const active = t.customerId === selectedId;
          const unread = t.unreadCount > 0;
          const preview = t.lastMessage.body || (t.lastMessage.hasMedia ? '📷 Photo' : '');
          return (
            <Link
              key={t.customerId}
              href={`/dashboard/messages?customer=${t.customerId}`}
              className={`block px-4 py-3 border-b border-border ${active ? 'bg-brand/5' : 'hover:bg-bg'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${unread ? 'font-bold text-text' : 'font-medium text-text'}`}>{t.customerName}</p>
                <span className={`text-xs shrink-0 ${unread ? 'text-brand font-semibold' : 'text-text-muted'}`}>{formatInboxTime(t.lastMessage.createdAt, timeZone)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className={`text-xs truncate ${unread ? 'text-text' : 'text-text-muted'}`}>
                  {t.lastMessage.direction === 'outbound' ? 'You: ' : ''}{preview}
                </p>
                {unread && (
                  <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center">
                    {t.unreadCount}
                  </span>
                )}
              </div>
              <p className="sr-only">{formatPhone(t.phoneNumber)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
