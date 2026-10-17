import { ensureGoogleResidentProfile, GoogleResidentProfileError } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ResidentProfile } from '@/lib/auth/require-user';
import { isAuthSessionMissingError } from '@supabase/supabase-js';

/**
 * The guest-friendly counterpart of requireUser() — used by routes that must render for
 * both signed-out visitors and residents (currently just /home, per the plan's Route
 * Contract Matrix — a requireUser() mistake there would break guest browsing entirely).
 *
 * Authenticated users of every role use the resident home shell.
 */
export async function getOptionalUser(client?: Awaited<ReturnType<typeof createSupabaseServerClient>>, options?: { failOnReadError: boolean }): Promise<
  { user: { id: string; email: string | undefined }; profile: ResidentProfile | null; profileSetupPending: boolean } | { user: null; profile: null; profileSetupPending: false }
> {
  const supabase = client ?? await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (options?.failOnReadError && authError && !isAuthSessionMissingError(authError)) throw new Error('Account information is unavailable.');

  if (!user) {
    return { user: null, profile: null, profileSetupPending: false };
  }

  let profileSetupPending = false;
  try {
    await ensureGoogleResidentProfile(supabase, user);
  } catch (cause) {
    if (!(cause instanceof GoogleResidentProfileError)) throw cause;
    // An expected setup outage must not break public browsing or claim a save.
    // Resident action guards still require successful setup and complete fields.
    profileSetupPending = true;
    console.warn('Google resident profile setup unavailable', { code: cause.code });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name, barangay_id, avatar_url, barangays(name)')
    .eq('id', user.id)
    .single();

  if (options?.failOnReadError && (profileError || user.is_anonymous)) throw new Error('Resident account information is unavailable.');

  if (!profile) {
    return { user: { id: user.id, email: user.email }, profile: null, profileSetupPending };
  }

  const { data: locality } = await supabase.from('barangay_localities')
    .select('display_name').eq('barangay_id', profile.barangay_id).maybeSingle();

  return {
    user: { id: user.id, email: user.email },
    profileSetupPending,
    profile: {
      id: profile.id,
      role: profile.role,
      full_name: profile.full_name,
      barangay_id: profile.barangay_id,
      avatar_url: profile.avatar_url,
      barangayName: locality?.display_name ?? profile.barangays?.name ?? 'Barangay',
    },
  };
}
