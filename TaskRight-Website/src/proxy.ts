import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/session';

// Protects /dashboard/* — redirects to the login page when there's no session.
// The login page itself is excluded so it doesn't redirect-loop.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dashboard/login')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/dashboard/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
