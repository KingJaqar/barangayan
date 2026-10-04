import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';
import { boundedAuthFetch } from './auth-fetch';

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
  flowType?: 'pkce' | 'implicit';
}

/**
 * Platform-agnostic Supabase client factory used directly by apps/resident-android-mobile and by
 * apps/admin-web's client components. apps/admin-web additionally has its own server-side helpers
 * (via @supabase/ssr, under apps/admin-web/src/lib) for Server Components/Route Handlers —
 * those are NOT built on this factory, since SSR cookie handling is Next.js-specific.
 *
 * Always constructed with the public `anon` key only (AGENTS.md §5 — Secrets & Payment
 * Trust Boundary). Never pass a service_role key here.
 */
export function createSupabaseClient({
  url,
  anonKey,
  authStorage,
  flowType,
}: SupabaseClientConfig): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    ...(flowType === 'pkce' ? { global: { fetch: boundedAuthFetch } } : {}),
    auth: authStorage
      ? {
          storage: authStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          ...(flowType ? { flowType } : {}),
        }
      : undefined,
  });
}
