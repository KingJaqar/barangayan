import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

// Qualify the installed SDK's local cleanup contract, including a failed
// server revoke. All session fields below are synthetic and kept in memory.
describe('installed Auth SDK local sign-out', () => {
  it.each(['server failure', 'network loss'])('removes the local session after %s', async failure => {
    const key = 'phase2-synthetic-session';
    const values = new Map([[key, JSON.stringify({
      access_token: 'synthetic-access-token', refresh_token: 'synthetic-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: 'synthetic-google-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-09T00:00:00Z' },
    })]]);
    const client = createClient('https://synthetic.invalid', 'synthetic-public-key', {
      auth: { storageKey: key, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
        storage: { getItem: name => values.get(name) ?? null, setItem: (name, value) => { values.set(name, value); }, removeItem: name => { values.delete(name); } } },
      global: { fetch: async () => {
        if (failure === 'network loss') throw new TypeError('Synthetic offline transport');
        return new Response(JSON.stringify({ code: 'unexpected_failure', msg: 'Synthetic server outage' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      } },
    });
    expect((await client.auth.getSession()).data.session?.user.id).toBe('synthetic-google-user');
    const result = await client.auth.signOut({ scope: 'local' });
    expect(result.error).not.toBeNull();
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect(values.has(key)).toBe(false);
  });
});
