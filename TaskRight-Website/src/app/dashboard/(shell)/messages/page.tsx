import { requireSession, businessGet } from '@/lib/serverApi';
import type { InboxThread, ThreadMessage } from '@/lib/messages';
import InboxList from '@/components/dashboard/messages/InboxList';
import ThreadPanel from '@/components/dashboard/messages/ThreadPanel';

type Thread = { messages: ThreadMessage[]; pagination: { hasMore: boolean; nextCursor: number | null } };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const session = await requireSession();
  const { customer: customerParam } = await searchParams;
  const selectedId = customerParam && /^\d+$/.test(customerParam) ? Number(customerParam) : null;

  const [inboxRes, customersRes, threadRes] = await Promise.all([
    businessGet<{ threads: InboxThread[]; totalUnread: number }>(session, '/messages/inbox'),
    businessGet<{ customers: { id: number; name: string; phoneNumber: string }[] }>(session, '/customers'),
    selectedId ? businessGet<Thread>(session, `/customers/${selectedId}/messages`) : null,
  ]);
  const threads = inboxRes?.threads ?? [];
  const customers = customersRes?.customers ?? [];
  const selected = selectedId != null ? customers.find(c => c.id === selectedId) ?? null : null;
  const unreadCount = threads.find(t => t.customerId === selectedId)?.unreadCount ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text mb-1">Messages</h2>
        <p className="text-text-muted text-sm">
          {inboxRes && inboxRes.totalUnread > 0 ? `${inboxRes.totalUnread} unread message${inboxRes.totalUnread === 1 ? '' : 's'}.` : 'All your customer texts in one place.'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr] h-[calc(100vh-12rem)] min-h-[480px]">
        <div className={`border-r border-border min-h-0 ${selected ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
          <InboxList threads={threads} selectedId={selectedId} customers={customers.map(c => ({ id: c.id, name: c.name }))} />
        </div>
        <div className={`min-h-0 ${selected ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
          {selected && threadRes ? (
            <ThreadPanel
              businessId={session.businessId}
              customer={selected}
              messages={threadRes.messages}
              nextCursor={threadRes.pagination.nextCursor}
              unreadCount={unreadCount}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <p className="text-text text-sm font-medium">{selectedId ? 'Customer not found' : 'Pick a conversation'}</p>
                <p className="text-text-muted text-xs mt-1">Replies, reminders and photos from every customer — answer them from your desk.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
