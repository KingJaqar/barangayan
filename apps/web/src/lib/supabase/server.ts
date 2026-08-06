import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@barangayan/shared';

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Next.js 16's `cookies()` is async — must be awaited (see apps/web/AGENTS.md on
 * this being a version with breaking changes vs. older Next.js APIs).
 *
 * Uses the public anon key + the caller's session cookies, so RLS still applies —
 * this is NOT the service_role client. Never add a service_role variant here without
 * re-reading AGENTS.md §5 (Secrets & Payment Trust Boundary) first.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — safe to ignore as long as
            // middleware is refreshing the session (add that when auth lands in Month 2).
          }
        },
      },
    },
  );
}
