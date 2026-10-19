import {
  ensureGoogleResidentProfile,
  getResidentAccountSetupStatus,
  residentProfileComplete,
  type Database,
  type ResidentAccountSetupStatus,
} from '@barangayan/shared';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Every admitted account needs a settled Settings status, including staff who
 * can browse the resident app but cannot call the resident-only setup RPC. */
export async function loadAccountSetupStatus(
  client: SupabaseClient<Database>,
  user: User,
  signal: AbortSignal,
): Promise<{ actor: 'resident' | 'staff'; status: ResidentAccountSetupStatus }> {
  const { data: profile, error } = await client.from('profiles').select('*').eq('id', user.id).abortSignal(signal).maybeSingle();
  if (error) throw error;
  if (profile?.deleted_at) throw { code: '42501' };
  if (profile && profile.role !== 'resident') {
    // Resident onboarding does not describe staff credentials. Preserve unknown
    // password provenance: Manage Password requires the current password or email
    // recovery, and never unlocks the first-password Google flow.
    return { actor: 'staff', status: {
      registrationOrigin: 'legacy',
      profileComplete: residentProfileComplete(profile, { includeAdmin: true }),
      passwordSet: null,
      hasGoogleIdentity: user.identities?.some(identity => identity.provider === 'google') ?? false,
    } };
  }
  await ensureGoogleResidentProfile(client, user);
  return { actor: 'resident', status: await getResidentAccountSetupStatus(client) };
}
