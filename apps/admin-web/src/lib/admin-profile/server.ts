import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PROFILE_FIELDS, type Outcome, type ProfileDatabase, type ProfileDetails, type ResidentSection, type StaffSummary } from './schema';

export async function activeAdmin(allowMfaChallenge = false) {
  const client = await createSupabaseServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.is_anonymous) return null;
  const { data: profile, error: profileError } = await client.from('profiles').select(`${PROFILE_FIELDS},barangays(name)`).eq('id', user.id).single();
  if (profileError) throw new Error('Admin profile could not be loaded.');
  if (!profile || profile.role !== 'admin' || profile.deleted_at) return null;
  const staffResult = await client.from('barangay_officials').select('official_role,is_active,date_hired,deleted_at,barangay_id').eq('profile_id', user.id).maybeSingle();
  if (staffResult.error) throw new Error('Staff access could not be checked.');
  if (staffResult.data && (!staffResult.data.is_active || staffResult.data.deleted_at || staffResult.data.barangay_id !== profile.barangay_id)) return null;
  const scoped = client as unknown as SupabaseClient<ProfileDatabase>;
  let mfaRequired = false;
  if (profileCapabilities().enabled) {
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw new Error('Admin multi-factor access could not be checked.');
    mfaRequired = assurance.data?.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2';
    if (!(mfaRequired && allowMfaChallenge)) {
      const access = await scoped.rpc('admin_profile_access', {});
      if (access.error?.code === '42501' || access.error?.code === 'PGRST301') return null;
      if (access.error || !access.data) throw new Error('Current admin session could not be checked.');
    }
  }
  const staff = staffResult.data ? { official_role: staffResult.data.official_role, is_active: staffResult.data.is_active, date_hired: staffResult.data.date_hired } : null;
  return { client: scoped, user, profile, staff, mfaRequired, barangayName: profile.barangays?.name ?? 'Barangay not provided' };
}

export async function residentSection(client: SupabaseClient<ProfileDatabase>, admin: ProfileDetails): Promise<ResidentSection> {
  const association = await client.from('admin_resident_associations').select('resident_id,linked_at').eq('admin_id', admin.id).maybeSingle();
  if (association.error) return { state: 'error', message: 'Associated account details could not be loaded. Retry this section.' };
  if (!association.data) return { state: 'none', message: 'No resident account is linked. Linking requires an existing resident account and proof of ownership.' };
  const availability = await client.rpc('admin_profile_resident_available', {});
  if (availability.error) return { state: 'error', message: 'Associated account access could not be checked. Retry this section.' };
  const unavailable = { state: 'unavailable' as const, residentId: association.data.resident_id, linkedAt: association.data.linked_at, message: 'The linked resident account is unavailable. Unlink it before establishing a new verified association.' };
  if (!availability.data) return unavailable;
  const resident = await client.from('profiles').select(PROFILE_FIELDS).eq('id', association.data.resident_id).eq('barangay_id', admin.barangay_id).eq('role', 'resident').is('deleted_at', null).maybeSingle();
  if (resident.error) return { state: 'error', message: 'The linked resident account could not be loaded. Your admin profile remains available.' };
  if (!resident.data) return unavailable;
  const household = await client.from('household_members').select('id', { count: 'exact', head: true }).eq('profile_id', resident.data.id).is('deleted_at', null);
  return { state: 'linked', profile: resident.data, linkedAt: association.data.linked_at, householdCount: household.error ? null : household.count };
}

export async function redactedAudit(client: SupabaseClient<ProfileDatabase>, profile: ProfileDetails, operation: string, fields: string[] = []) {
  try { const { error } = await client.from('admin_audit_log').insert({
    admin_id: profile.id, barangay_id: profile.barangay_id, action: 'update', entity_type: 'system',
    entity_id: profile.id, entity_label: 'Admin profile', metadata: { operation, fields },
  });
  return error ? 'The change completed, but its audit entry could not be recorded.' : undefined;
  } catch { return 'The change completed, but its audit entry could not be recorded.'; }
}

export type ProfileRead = Outcome<{ profile: ProfileDetails; staff: StaffSummary | null; resident: ResidentSection }>;

// Server-only rollout gates. Enable only after the recorded release checks pass.
export function profileCapabilities() {
  const enabled = process.env.ADMIN_PROFILE_ENABLED === 'true';
  const authVerified = process.env.ADMIN_PROFILE_AUTH_VERIFIED === 'true';
  const origin = process.env.ADMIN_PROFILE_ORIGIN;
  let callbackOrigin: string | null = null;
  try {
    if (origin) {
      const parsed = new URL(origin);
      if (parsed.origin === origin && (parsed.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname))) callbackOrigin = origin;
    }
  } catch { /* Invalid configuration keeps credential and provider controls disabled. */ }
  return { enabled, credentials: enabled && authVerified && Boolean(callbackOrigin), callbackOrigin };
}
