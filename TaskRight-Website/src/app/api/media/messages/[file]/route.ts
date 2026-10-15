import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// MMS media proxy: the backend stores inbound media under /uploads/messages/*.
// The browser loads it same-origin through here, and only with a portal session.
// Filenames are `<providerMessageId>_<n>.<ext>` — anything else is rejected
// (no path traversal into other backend paths).
const FILE_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,8}$/;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { file } = await params;
  if (!FILE_RE.test(file)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const res = await fetch(`${API_BASE}/uploads/messages/${file}`);
  if (!res.ok || !res.body) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
