'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { changePasswordSchema, newPasswordSchema, PASSWORD_COMPLEXITY_REGEX } from '@barangayan/shared';
import { activeAdmin, profileCapabilities, redactedAudit, residentSection, type ProfileRead } from '@/lib/admin-profile/server';
import { challengeSchema, hasStructuredName, ownedAvatarPath, profileFailure, profileSaveSchema, type Outcome, type ProfileDatabase, type ResidentSection } from '@/lib/admin-profile/schema';

function isolatedClient(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Auth configuration unavailable.');
  return createClient<ProfileDatabase>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}) });
}

export async function readAdminProfile(): Promise<ProfileRead> {
  try {
    if (!profileCapabilities().enabled) return profileFailure();
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    return { ok: true, value: { profile: actor.profile, staff: actor.staff, resident: await residentSection(actor.client, actor.profile) } };
  } catch { return profileFailure(); }
}

export async function readAssociatedResident(): Promise<Outcome<ResidentSection>> {
  try {
    if (!profileCapabilities().enabled) return profileFailure();
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    return { ok: true, value: await residentSection(actor.client, actor.profile) };
  } catch { return profileFailure(); }
}

export async function saveAdminProfile(input: unknown): Promise<Outcome<string>> {
  try {
    if (!profileCapabilities().enabled) return profileFailure();
    const parsed = profileSaveSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: 'validation', message: parsed.error.issues[0]?.message ?? 'Review your profile fields.' };
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    const { patch, expected } = parsed.data;
    if (patch.full_name !== undefined && hasStructuredName(actor.profile)) return { ok: false, code: 'validation', message: 'Structured names are read-only here. Contact staff administration to correct your name.' };
    const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (patch.avatar_url && (!apiUrl || !ownedAvatarPath(patch.avatar_url, actor.user.id, apiUrl))) return { ok: false, code: 'validation', message: 'Upload a new photo to your own account.' };
    const result = await actor.client.rpc('admin_update_own_profile', { p_patch: patch, p_expected: expected });
    if (result.error) return profileFailure(result.error.code);
    if (!result.data) return profileFailure();
    const warning = await redactedAudit(actor.client, actor.profile, 'save_admin_profile', Object.keys(patch));
    return { ok: true, value: result.data, warning };
  } catch { return profileFailure(); }
}

export async function beginResidentAssociation(): Promise<Outcome<string>> {
  try {
    if (!profileCapabilities().credentials) return profileFailure();
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    const result = await actor.client.rpc('admin_begin_resident_association', {});
    return result.error || !result.data ? profileFailure(result.error?.code) : { ok: true, value: result.data };
  } catch { return profileFailure(); }
}

export async function finishResidentAssociation(challenge: unknown): Promise<Outcome<string>> {
  try {
    if (!profileCapabilities().credentials) return profileFailure();
    const parsed = challengeSchema.safeParse(challenge);
    if (!parsed.success) return profileFailure('22023');
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    const result = await actor.client.rpc('admin_finish_resident_association', { p_challenge: parsed.data });
    return result.error || !result.data ? profileFailure(result.error?.code) : { ok: true, value: result.data };
  } catch { return profileFailure(); }
}

export async function cancelResidentAssociation(challenge: unknown): Promise<Outcome<boolean>> {
  try {
    if (!profileCapabilities().enabled) return profileFailure();
    const parsed = challengeSchema.safeParse(challenge);
    if (!parsed.success) return profileFailure('22023');
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    const result = await actor.client.rpc('admin_cancel_resident_association', { p_challenge: parsed.data });
    return result.error ? profileFailure(result.error.code) : { ok: true, value: result.data };
  } catch { return profileFailure(); }
}

export async function unlinkResidentAssociation(input: unknown): Promise<Outcome<boolean>> {
  try {
    if (!profileCapabilities().enabled) return profileFailure();
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    const parsed = z.object({ residentId: challengeSchema, linkedAt: z.string().datetime({ offset: true }) }).strict().safeParse(input);
    if (!parsed.success) return profileFailure('22023');
    const link = await actor.client.from('admin_resident_associations').select('resident_id,linked_at').eq('admin_id', actor.user.id).maybeSingle();
    if (link.error || !link.data || parsed.data.residentId !== link.data.resident_id || parsed.data.linkedAt !== link.data.linked_at) return profileFailure('PT409');
    const result = await actor.client.rpc('admin_unlink_resident_association', { p_resident: link.data.resident_id, p_expected: parsed.data.linkedAt });
    return result.error || result.data !== true ? profileFailure(result.error?.code) : { ok: true, value: true };
  } catch { return profileFailure(); }
}

const proofFields = { currentPassword: z.string().min(1).max(1024).optional(), accessToken: z.string().min(1).max(16384).optional() };
const emailChangeSchema = z.object({ email: z.string().trim().email().max(254), ...proofFields }).strict().refine(value => Boolean(value.currentPassword) !== Boolean(value.accessToken), 'Verify with your password or provider.');
const passwordChangeSchema = z.object({ ...proofFields, newPassword: z.string().max(1024), confirmPassword: z.string().max(1024), nonce: z.string().regex(/^\d{6,10}$/).optional() }).strict().refine(value => Boolean(value.currentPassword) !== Boolean(value.accessToken), 'Verify with your password or provider.');
type CredentialValue = { signInRequired: boolean; sessionsRevoked: boolean };
type CredentialOutcome = Outcome<CredentialValue> & { sessionsRevoked?: boolean };

async function passwordNotice(value: 'changed' | 'cleanup_pending' | 'review_required', origin: string) {
  const cookieStore = await cookies();
  cookieStore.set('barangayan-profile-password-notice', value, {
    httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https:'), path: '/login', maxAge: 120,
  });
}

async function credentialChange(input: unknown, operation: 'email' | 'password'): Promise<CredentialOutcome> {
  let proof: ReturnType<typeof isolatedClient>;
  try { proof = isolatedClient(); } catch { return profileFailure(); }
  const result = await runCredentialChange(input, operation, proof);
  let cleanupFailed = false;
  try { const cleanup = await proof.auth.signOut({ scope: 'local' }); cleanupFailed = Boolean(cleanup.error); } catch { cleanupFailed = true; }
  if (!cleanupFailed) return result;
  const recovery = 'Temporary admin verification could not be retired. Sign out of admin sessions before verifying again.';
  return result.ok ? { ...result, warning: result.warning ? result.warning + ' ' + recovery : recovery } : { ...result, message: result.message + ' ' + recovery };
}

async function runCredentialChange(input: unknown, operation: 'email' | 'password', proof: ReturnType<typeof isolatedClient>): Promise<CredentialOutcome> {
  const capability = profileCapabilities();
  if (!capability.credentials || !capability.callbackOrigin) return { ok: false, code: 'unavailable', message: 'Account security changes are unavailable until sign-in and email delivery checks are completed.' };
  try {
    const actor = await activeAdmin();
    if (!actor || !actor.user.email) return profileFailure('42501');
    const parsed = operation === 'email' ? emailChangeSchema.safeParse(input) : passwordChangeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: 'validation', message: parsed.error.issues[0]?.message ?? 'Review your security fields.' };
    const values = parsed.data;
    if ('newPassword' in values) {
      const password = values.currentPassword ? changePasswordSchema.safeParse(values) : newPasswordSchema.safeParse({ password: values.newPassword, confirmPassword: values.confirmPassword });
      if (!password.success) return { ok: false, code: 'validation', message: password.error.issues[0]?.message ?? 'Review your password.' };
      if (!PASSWORD_COMPLEXITY_REGEX.test(values.newPassword) || !/[a-z]/.test(values.newPassword)) return { ok: false, code: 'validation', message: 'Include uppercase and lowercase letters, a number and a special character in your password.' };
    }
    const assurance = await actor.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || (assurance.data?.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2')) return { ok: false, code: 'access', message: 'Complete your admin multi-factor sign-in before changing account security.' };
    if (values.accessToken) {
      const providerProof = isolatedClient(values.accessToken);
      const verified = await providerProof.auth.getUser(values.accessToken);
      if (verified.error || verified.data.user?.id !== actor.user.id) return profileFailure('42501');
      const recent = await providerProof.rpc('admin_profile_verify_fresh_session', {});
      if (recent.error || recent.data !== true) return { ok: false, code: 'access', message: 'Account ownership proof expired. Verify your admin account in a separate sign-in again.' };
    } else if (values.currentPassword) {
      const verified = await proof.auth.signInWithPassword({ email: actor.user.email, password: values.currentPassword });
      if (verified.error || verified.data.user?.id !== actor.user.id) return { ok: false, code: 'access', message: 'Current password could not be verified. Try provider verification if this account has no password.' };
    } else return profileFailure('42501');
    // Recheck after proof. Never use a client-selected user or an Admin API update.
    const current = await activeAdmin();
    if (!current || current.user.id !== actor.user.id) return profileFailure('42501');
    const result = 'email' in values
      ? await current.client.auth.updateUser({ email: values.email }, { emailRedirectTo: `${capability.callbackOrigin}/profile/security-callback` })
      : await current.client.auth.updateUser({ password: values.newPassword, ...(values.currentPassword ? { current_password: values.currentPassword } : {}), ...(values.nonce ? { nonce: values.nonce } : {}) });
    if (result.error) {
      if (result.error.status === 429) return profileFailure('429');
      if (!result.error.status || result.error.status >= 500) {
        if (operation === 'password') {
          let sessionsRevoked = false;
          try { sessionsRevoked = !(await current.client.auth.signOut({ scope: 'global' })).error; } catch { /* The login notice reports attempted cleanup, not guaranteed revocation. */ }
          await passwordNotice('review_required', capability.callbackOrigin);
          return { ok: false, code: 'unavailable', sessionsRevoked, message: 'The password outcome could not be confirmed. Sign in with your current or new password before repeating a change. Admin session cleanup was attempted.' };
        }
        return profileFailure();
      }
      if (result.error.code === 'reauthentication_needed') return { ok: false, code: 'validation', message: 'Request a verification code, then enter it with your password change.' };
      if (result.error.code === 'weak_password') return { ok: false, code: 'validation', message: 'Choose a longer, unique password with uppercase and lowercase letters, a number and a special character.' };
      return { ok: false, code: 'validation', message: operation === 'email' ? 'Email change was not accepted. Check the address, availability and inbox access; wait before retrying if rate limited.' : 'Password change was not accepted. Check your password and verification code, then try again.' };
    }
    const warning = await redactedAudit(current.client, current.profile, `change_admin_${operation}`);
    if (operation === 'email') return { ok: true, value: { signInRequired: false, sessionsRevoked: false }, warning };
    let cleanupFailed = false;
    try { const retired = await current.client.auth.signOut({ scope: 'global' }); cleanupFailed = Boolean(retired.error); } catch { cleanupFailed = true; }
    await passwordNotice(cleanupFailed ? 'cleanup_pending' : 'changed', capability.callbackOrigin);
    return { ok: true, value: { signInRequired: true, sessionsRevoked: !cleanupFailed }, warning: cleanupFailed ? 'Password changed, but session cleanup failed. Sign out and sign in again; do not repeat the password change.' : warning };
  } catch { return profileFailure(); }
}

export async function changeAdminEmail(input: unknown) { return credentialChange(input, 'email'); }
export async function changeAdminPassword(input: unknown) { return credentialChange(input, 'password'); }

export async function readAdminSecurity(): Promise<Outcome<{ email: string | null; newEmail: string | null; confirmed: boolean; providers: string[] }>> {
  try {
    if (!profileCapabilities().enabled) return profileFailure();
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    return { ok: true, value: { email: actor.user.email ?? null, newEmail: actor.user.new_email ?? null, confirmed: Boolean(actor.user.email_confirmed_at), providers: [...new Set(actor.user.identities?.map(identity => identity.provider) ?? [])] } };
  } catch { return profileFailure(); }
}

export async function requestAdminSecurityCode(): Promise<Outcome<boolean>> {
  try {
    if (!profileCapabilities().credentials) return profileFailure();
    const actor = await activeAdmin();
    if (!actor) return profileFailure('42501');
    const { error } = await actor.client.auth.reauthenticate();
    return error ? profileFailure(error.code) : { ok: true, value: true };
  } catch { return profileFailure(); }
}
