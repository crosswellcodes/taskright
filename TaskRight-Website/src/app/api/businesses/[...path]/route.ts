import { NextRequest, NextResponse } from 'next/server';
import { getSession, TOKEN_COOKIE, BUSINESS_ID_COOKIE } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// BFF proxy: holds the httpOnly-cookie JWT server-side and forwards it as a
// Bearer header to the backend's /api/businesses/* routes — the browser never
// sees the token. See WEB_PORTAL.md §2.
async function proxy(request: NextRequest, path: string[]) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized', code: 'MISSING_TOKEN' }, { status: 401 });
  }

  const url = `${API_BASE}/api/businesses/${path.join('/')}${request.nextUrl.search}`;
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE';

  const init: RequestInit = {
    method: request.method,
    headers: {
      Authorization: `Bearer ${session.token}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (hasBody) {
    const body = await request.text();
    if (body) init.body = body;
  }

  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));

  const response = NextResponse.json(data, { status: res.status });
  if (res.status === 401) {
    response.cookies.delete(TOKEN_COOKIE);
    response.cookies.delete(BUSINESS_ID_COOKIE);
  }
  return response;
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return proxy(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: RouteParams) {
  return proxy(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return proxy(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return proxy(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return proxy(request, (await params).path);
}
