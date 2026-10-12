'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Only copy the address confirmed by Auth, using the caller's own RLS session. */
export async function syncResidentSignInEmail(expectedUserId: string) {
  try {
    const client = await createSupabaseServerClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    const user = auth.user;
    if (authError || !user?.email || user.is_anonymous || user.id !== expectedUserId) {
      return { ok: false as const, message: 'Your session changed. Sign in again to update your email.' };
    }
    const { data: profile, error } = await client.from('profiles').select('email,email_verification_status')
      .eq('id', user.id).eq('role', 'resident').is('deleted_at', null).single();
    if (error || !profile) return { ok: false as const, message: 'Unable to load your email details. Try again.' };
    if (profile.email?.trim().toLowerCase() === user.email.trim().toLowerCase()) {
      return { ok: true as const, email: user.email, pendingEmail: user.new_email ?? '', status: profile.email_verification_status };
    }
    // Keep the previous address in the predicate so a concurrent edit cannot be overwritten.
    let update = client.from('profiles').update({ email: user.email })
      .eq('id', user.id).eq('role', 'resident').is('deleted_at', null);
    update = profile.email === null ? update.is('email', null) : update.eq('email', profile.email);
    const { data: updated, error: updateError } = await update.select('email_verification_status').single();
    if (updateError || !updated) return { ok: false as const, message: 'Unable to sync your confirmed email. Try again.' };
    // The existing database trigger invalidates verification for a changed address.
    return { ok: true as const, email: user.email, pendingEmail: user.new_email ?? '', status: updated.email_verification_status };
  } catch {
    return { ok: false as const, message: 'Unable to update your email details. Check your connection and retry.' };
  }
}
