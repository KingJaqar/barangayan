import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request so Server Components (which
 * can only set cookies via a response, not during render) stay in sync — the
 * lib/supabase/server.ts comment flagged this as "Month 2" work; this is that logic.
 * Named `proxy`, not `middleware` — Next.js 16 renamed the convention (same behavior,
 * see apps/admin-web/AGENTS.md's warning to check versioned docs before assuming an older
 * Next.js API still applies). Runs for every route except static assets (see
 * `config.matcher` below).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
