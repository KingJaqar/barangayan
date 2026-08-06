import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

export interface SupabaseAuthStorage {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  /** Custom auth storage adapter — e.g. AsyncStorage on React Native. Omit on web (browser default). */
  authStorage?: SupabaseAuthStorage;
}

/**
 * Platform-agnostic Supabase client factory used directly by apps/mobile and by
 * apps/web's client components. apps/web additionally has its own server-side helpers
 * (via @supabase/ssr, under apps/web/src/lib) for Server Components/Route Handlers —
 * those are NOT built on this factory, since SSR cookie handling is Next.js-specific.
 *
 * Always constructed with the public `anon` key only (AGENTS.md §5 — Secrets & Payment
 * Trust Boundary). Never pass a service_role key here.
 */
export function createSupabaseClient({
  url,
  anonKey,
  authStorage,
}: SupabaseClientConfig): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: authStorage
      ? {
          storage: authStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }
      : undefined,
  });
}
