import { NextResponse } from 'next/server';
import { TOKEN_COOKIE, BUSINESS_ID_COOKIE, cookieOptions } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Verifies phone + OTP against the backend, then holds the returned JWT in an
// httpOnly cookie — the token never reaches browser JS. See WEB_PORTAL.md §9.1.
export async function POST(request: Request) {
  const { phoneNumber, otpCode } = await request.json();
  if (!phoneNumber || !otpCode) {
    return NextResponse.json({ success: false, error: 'Phone number and code are required' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/api/auth/businesses/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, otpCode }),
  });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ success: false, error: data.error || 'Login failed', code: data.code }, { status: res.status });
  }

  const response = NextResponse.json({ success: true, business: data.business });
  const opts = cookieOptions();
  response.cookies.set(TOKEN_COOKIE, data.token, opts);
  response.cookies.set(BUSINESS_ID_COOKIE, String(data.business.id), opts);
  return response;
}
