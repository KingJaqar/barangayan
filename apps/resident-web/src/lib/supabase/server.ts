import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@barangayan/shared';

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions. Next.js
 * 16's `cookies()` is async — must be awaited.
 *
 * Uses the public anon key + the caller's session cookies, so RLS still applies — this
 * is NOT the service_role client. resident-web never carries SUPABASE_SERVICE_ROLE_KEY
 * (see the plan's §7/§8) — do not add a service_role variant here.
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
            // Called from a Server Component render — safe to ignore since proxy.ts is
            // refreshing the session cookie on every request.
          }
        },
      },
    },
  );
}
