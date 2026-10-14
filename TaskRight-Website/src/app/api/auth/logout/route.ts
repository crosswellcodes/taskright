import { NextResponse } from 'next/server';
import { TOKEN_COOKIE, BUSINESS_ID_COOKIE } from '@/lib/session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(TOKEN_COOKIE);
  response.cookies.delete(BUSINESS_ID_COOKIE);
  return response;
}
