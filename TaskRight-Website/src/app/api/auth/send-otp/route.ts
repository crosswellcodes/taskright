import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Sends a login OTP via the backend's configured SMS provider.
// Public — no session required (this is how a session begins).
export async function POST(request: Request) {
  const { phoneNumber } = await request.json();
  if (!phoneNumber) {
    return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/api/auth/verify/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
