import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Sends a login OTP via the backend's configured SMS provider.
// Public — no session required (this is how a session begins).
export async function POST(request: Request) {
  const { phoneNumber } = await request.json();
  if (!phoneNumber) {
    return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
  }

  // Every call from here reaches the backend from Vercel's IPs, so pass the
  // browser's IP for the backend's per-IP send limit. The backend only trusts it
  // alongside the shared OTP_PROXY_SECRET (server-only env, never NEXT_PUBLIC_).
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.OTP_PROXY_SECRET;
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip');
  if (secret && clientIp) {
    headers['X-TaskRight-Proxy-Secret'] = secret;
    headers['X-TaskRight-Client-IP'] = clientIp;
  }

  const res = await fetch(`${API_BASE}/api/auth/verify/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phoneNumber }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
