import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request so Server Components (which
 * can only set cookies via a response, not during render) stay in sync. Named `proxy`,
 * not `middleware` — Next.js 16 renamed the convention (see apps/admin-web/src/proxy.ts,
 * copied 1:1 here for the cookie-refresh part — same Supabase project, same session-
 * refresh need). Runs for every route except static assets (see `config.matcher` below).
 *
 * Also stamps `x-pathname` on the outgoing request headers (the documented Next.js
 * pattern for propagating a computed header into Server Component `headers()` reads —
 * `request.headers` itself is not writable in a way guaranteed to reach the render).
 * lib/auth/require-user.ts reads it to build the `next=` redirect target — there is no
 * other way to recover the resolved pathname from a Server Component render.
 */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Touching getUser() is what actually triggers a token refresh when the access
  // token is near expiry — a bare getSession() here wouldn't refresh anything.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
