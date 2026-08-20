import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@barangayan/shared';

/** Supabase client for Client Components — safe to use only the public anon key here. */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
