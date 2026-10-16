// Shared Messages-module types + helpers (WEB_PORTAL M4).
import { dateKeyIn } from '@/lib/schedule';

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

// Inbox timestamp: time today, weekday this week, else a short date — all in
// the business's zone (these render on the server first, then hydrate).
export function formatInboxTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  if (dateKeyIn(timeZone, d) === dateKeyIn(timeZone)) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
  if (Date.now() - d.getTime() < 6 * 864e5) return d.toLocaleDateString('en-US', { weekday: 'short', timeZone });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
}

export function formatBubbleTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone });
}
