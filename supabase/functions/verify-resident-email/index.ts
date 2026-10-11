import { createClient } from '@supabase/supabase-js';
import { emailVerificationHandler, EmailVerificationError } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
};
const admin = createClient(url, service, options);

Deno.serve(emailVerificationHandler({
  caller: async authorization => {
    const client = createClient(url, anon, { ...options, global: { ...options.global, headers: { Authorization: authorization } } });
    const { data, error } = await client.auth.getUser();
    const user = data.user;
    return !error && user?.email && !user.is_anonymous ? { id: user.id, email: user.email } : null;
  },
  profile: async id => {
    const { data, error } = await admin.from('profiles').select('email,email_verification_status')
      .eq('id', id).eq('role', 'resident').is('deleted_at', null).maybeSingle();
    if (error) throw new Error('Profile unavailable');
    return data ? { email: data.email, status: data.email_verification_status } : null;
  },
  send: async email => {
    // An independent client keeps the resident's original session unchanged.
    const sender = createClient(url, anon, options);
    const { error } = await sender.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw new EmailVerificationError(error.status === 429 ? 429 : 503,
      error.status === 429 ? 'Please wait before requesting another code.' : 'The code could not be sent. Retry in a moment.');
  },
  verify: async (email, token) => {
    const verifier = createClient(url, anon, options);
    const { data, error } = await verifier.auth.verifyOtp({ email, token, type: 'email' });
    if (error?.status === 429) throw new EmailVerificationError(429, 'Please wait before trying another code.');
    const user = data.user;
    const result = !error && data.session && user?.email ? { id: user.id, email: user.email } : null;
    // Retire only this endpoint's ephemeral OTP session, never the app session.
    if (data.session) await verifier.auth.signOut({ scope: 'local' }).catch(() => {});
    return result;
  },
  record: async (caller, profileEmail, verified) => {
    // Conditions are checked atomically; concurrent address/deletion/role edits
    // cannot receive a badge for the earlier profile. Service-only fields remain
    // inaccessible to resident REST clients.
    const now = new Date().toISOString();
    const { data, error } = await admin.from('profiles').update(verified
      ? { email_verification_status: 'verified', email_verified_at: now }
      : { email_verification_status: 'pending', email_verification_requested_at: now })
      .eq('id', caller.id).eq('email', profileEmail).eq('role', 'resident').is('deleted_at', null)
      .neq('email_verification_status', 'verified').select('id');
    if (error) throw new Error('Verification status unavailable');
    return data?.length === 1;
  },
}));
