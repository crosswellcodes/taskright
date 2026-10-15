// Shared Messages-module types + helpers (WEB_PORTAL M4).

export type InboxThread = {
  customerId: number;
  customerName: string;
  phoneNumber: string;
  unreadCount: number;
  lastMessage: { id: number; direction: 'inbound' | 'outbound'; body: string; hasMedia: boolean; createdAt: string };
};

export type ThreadMessage = {
  id: number;
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: string;
  mediaUrls: string[] | null;
};

// Backend stores "/uploads/messages/<file>"; the browser loads it through the
// session-checked proxy at /api/media/messages/<file>.
export function mediaSrc(stored: string) {
  return `/api/media/messages/${stored.split('/').pop()}`;
}

// Inbox timestamp: time today, weekday this week, else a short date.
export function formatInboxTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (now.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatBubbleTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
