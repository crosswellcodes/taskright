'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { get, post, type ApiError } from '@/lib/apiClient';
import { type ThreadMessage, formatBubbleTime, mediaSrc } from '@/lib/messages';
import { formatPhone } from '@/lib/customers';

type Props = {
  businessId: string;
  customer: { id: number; name: string; phoneNumber: string };
  messages: ThreadMessage[];
  nextCursor: number | null;
  unreadCount: number;
  timeZone: string;
};

const POLL_MS = 20000;

// Right pane: one customer's SMS thread. Marks unread inbound read when shown
// (explicit POST), polls for new messages while the tab is visible, and sends
// replies through the BFF proxy.
export default function ThreadPanel({ businessId, customer, messages, nextCursor, unreadCount, timeZone }: Props) {
  const router = useRouter();
  const base = `/${businessId}/customers/${customer.id}/messages`;

  const [older, setOlder] = useState<ThreadMessage[]>([]);
  const [cursor, setCursor] = useState(nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  // Switching customers resets the paged-in history.
  useEffect(() => { setOlder([]); setCursor(nextCursor); setDraft(''); setError(null); }, [customer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anything unread in view → mark read, then refresh so inbox badges update.
  useEffect(() => {
    if (unreadCount > 0) post(`${base}/read`).then(() => router.refresh()).catch(() => {});
  }, [unreadCount, base, router]);

  // Poll for new messages while the tab is visible.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [router]);

  // Keep the newest message in view.
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [lastId, customer.id]);

  async function loadOlder() {
    if (cursor == null) return;
    setLoadingOlder(true);
    try {
      const res = await get(`${base}?before=${cursor}`);
      setOlder(prev => [...res.messages, ...prev]);
      setCursor(res.pagination.nextCursor);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await post(base, { body });
      setDraft('');
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message || 'Message not sent');
    } finally {
      setSending(false);
    }
  }

  // Polling can shift the newest-50 window under paged-in history — merge by id.
  const all = [...new Map([...older, ...messages].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border">
        <div className="min-w-0">
          <Link href="/dashboard/messages" className="lg:hidden text-text-muted text-xs hover:text-text">‹ All conversations</Link>
          <p className="text-text font-semibold truncate">{customer.name}</p>
          <p className="text-text-muted text-xs">{formatPhone(customer.phoneNumber)}</p>
        </div>
        <Link href={`/dashboard/customers/${customer.id}`} className="shrink-0 text-brand text-sm font-medium hover:underline">View customer</Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 bg-bg/50">
        {cursor != null && (
          <div className="text-center">
            <button type="button" onClick={loadOlder} disabled={loadingOlder} className="text-brand text-xs font-medium hover:underline disabled:opacity-50">
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}
        {all.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-10">No messages with {customer.name} yet. Say hello below.</p>
        ) : all.map(m => {
          const out = m.direction === 'outbound';
          return (
            <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 ${out ? 'bg-brand text-white rounded-br-md' : 'bg-white border border-border text-text rounded-bl-md'}`}>
                {m.mediaUrls?.map(u => (
                  <a key={u} href={mediaSrc(u)} target="_blank" rel="noreferrer" className="block mb-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaSrc(u)} alt="Photo from customer" className="rounded-lg max-h-60 w-auto" />
                  </a>
                ))}
                {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={`text-[11px] mt-1 ${out ? 'text-white/70' : 'text-text-muted'}`}>{formatBubbleTime(m.createdAt, timeZone)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3 sm:p-4">
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder={`Text ${customer.name}…`}
            aria-label="Message"
            className="flex-1 resize-none rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button type="button" onClick={send} disabled={!draft.trim() || sending} className="px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        <p className="text-text-muted text-[11px] mt-1.5">Sends as a text from your business number. Enter to send, Shift+Enter for a new line.</p>
      </div>
    </div>
  );
}
