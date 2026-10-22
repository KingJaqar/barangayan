import { createClient } from '@supabase/supabase-js';
import { boundedAuthFetch } from '@barangayan/shared';
const token = window.location.hash.slice(1);
const db = createClient(window.location.origin, token, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedAuthFetch } });
await db.auth.setSession({ access_token: token, refresh_token: 'synthetic-local-only' });
export function createSupabaseBrowserClient() { return db; }
Object.assign(window, { fixtureLogout: () => db.auth.signOut({ scope: 'local' }),
  fixtureSwitchAccount: (token: string) => db.auth.setSession({ access_token: token, refresh_token: 'synthetic-local-only' }) });
