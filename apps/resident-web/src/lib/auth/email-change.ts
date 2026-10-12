import { EMAIL_REGEX, type Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Auth owns the sign-in address; never write a requested address to profiles. */
export async function requestResidentEmailChange(
  client: SupabaseClient<Database>, ownerId: string, currentEmail: string, newEmail: string, origin: string,
) {
  const nextEmail = newEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(nextEmail)) throw new Error('Enter a valid email address.');
  if (nextEmail === currentEmail.trim().toLowerCase()) throw new Error('Enter a different email address.');
  const before = await client.auth.getUser();
  if (before.error || !before.data.user || before.data.user.is_anonymous || before.data.user.id !== ownerId ||
      before.data.user.email?.trim().toLowerCase() !== currentEmail.trim().toLowerCase()) {
    throw new Error('Your session changed. Reload this page before changing your email.');
  }
  const redirect = new URL('/auth/email-change', origin);
  const { data, error } = await client.auth.updateUser({ email: nextEmail }, { emailRedirectTo: redirect.href });
  if (error) throw new Error(error.status === 429 ? 'Please wait before requesting another email change.' : 'Unable to change your email. Check the address and try again.');
  if (data.user?.id !== ownerId) throw new Error('Your session changed. Reload this page before changing your email.');
  return nextEmail;
}
