import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Optional site-wide password gate, ported from ts-portal's Gatekeeper.
 *
 * With SITE_PASSWORD unset the portal is open and this is a no-op; with it set,
 * every page and data route requires the cookie issued by /api/auth/gatekeeper.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api');

  // The gate itself, and static assets, must stay reachable.
  if (
    pathname.startsWith('/gatekeeper') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.') || // images, fonts, etc.
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next();
  }

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('ts_site_access');
  if (authCookie?.value === sitePassword) {
    return NextResponse.next();
  }

  // API routes back the same content as the pages, so they are gated too —
  // otherwise transcripts stay readable straight from /api. They answer with a
  // status rather than a redirect, since a fetch can't follow one usefully.
  if (isApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/gatekeeper';
  // Store the original path to redirect back after login
  url.searchParams.set('callbackUrl', pathname);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match every request path except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
