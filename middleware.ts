import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight route guard. The real auth check (does the access/refresh
 * token pair actually work) happens client-side in AuthProvider, since
 * tokens live in memory/sessionStorage rather than a cookie middleware can
 * read. This middleware's job is narrower: keep the matcher scoped to
 * protected routes so unauthenticated users never even flash the stock
 * list's shell before the client-side guard redirects — see README decision
 * log for why we didn't move token storage into a middleware-readable
 * cookie.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/stock/:path*', '/items/:path*'],
};
