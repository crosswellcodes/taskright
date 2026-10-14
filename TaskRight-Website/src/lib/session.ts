import { cookies } from 'next/headers';

export const TOKEN_COOKIE = 'tr_token';
export const BUSINESS_ID_COOKIE = 'tr_business_id';

// Matches the backend JWT expiry (see backend/src/utils/jwt.js TOKEN_EXPIRY).
const MAX_AGE_SECONDS = 60 * 60 * 24;

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}

export type Session = { token: string; businessId: string };

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  const businessId = store.get(BUSINESS_ID_COOKIE)?.value;
  if (!token || !businessId) return null;
  return { token, businessId };
}
