import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { profileCompletionSchema } from '../schemas/service-foundations';

export const ANDROID_AUTH_CALLBACK = 'barangayan://auth/callback';

export class GoogleResidentProfileError extends Error {
  constructor(readonly code: string | null) {
    super('Unable to save your resident account. Check your connection and retry.');
    this.name = 'GoogleResidentProfileError';
  }
}

/** Provider data is only a call hint; the RPC verifies the Auth-managed identity. */
export async function ensureGoogleResidentProfile(client: SupabaseClient<Database>, user: Pick<User, 'app_metadata' | 'identities'>): Promise<void> {
  const providers: unknown = user.app_metadata.providers;
  const google = user.identities?.some(identity => identity.provider === 'google')
    || (Array.isArray(providers) && providers.includes('google'));
  if (!google) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await client.rpc('ensure_google_resident_profile').abortSignal(controller.signal);
    if (error || !data) throw new GoogleResidentProfileError(error?.code || null);
  } finally { clearTimeout(timer); }
}

/** Editable name suggestions only; metadata never establishes residency or ID approval. */
export function residentNamePrefill(
  metadata: Record<string, unknown> | null | undefined,
  profile?: Pick<Database['public']['Tables']['profiles']['Row'], 'first_name' | 'last_name'> | null,
): { firstName: string; lastName: string } {
  const nameText = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const given = nameText(metadata?.given_name) || nameText(metadata?.first_name);
  const family = nameText(metadata?.family_name) || nameText(metadata?.last_name);
  const full = nameText(metadata?.full_name) || nameText(metadata?.name);
  let suggestedFirst = '';
  let suggestedLast = '';
  if (given) {
    if (full.startsWith(`${given} `)) suggestedLast = full.slice(given.length + 1);
  } else if (family) {
    if (full.endsWith(` ${family}`)) suggestedFirst = full.slice(0, -(family.length + 1));
  } else {
    // A display name has no guaranteed first/last structure; the resident confirms it.
    const [first = '', ...rest] = full.split(' ');
    suggestedFirst = first;
    suggestedLast = rest.join(' ');
  }
  return {
    firstName: nameText(profile?.first_name) || given || suggestedFirst,
    lastName: nameText(profile?.last_name) || family || suggestedLast,
  };
}

/** Public browsing is available before completion; only resident actions are gated. */
export function residentActionNeedsProfile(pathname: string): boolean {
  return /^\/services\/(requests|request|payment)(\/|$)/.test(pathname)
    || /^\/health\/register(\/|$)/.test(pathname)
    || /^\/reports\/new(\/|$)/.test(pathname);
}

export function residentCompletionDestination(next: string | null): string {
  return `/complete-profile?next=${encodeURIComponent(safeResidentRedirect(next))}`;
}

export function safeResidentRedirect(value: string | null): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/home';
  try {
    const url = new URL(value, 'https://resident.invalid');
    if (url.origin !== 'https://resident.invalid' || /^\/(auth|login|register|complete-profile)(\/|$)/.test(url.pathname)) return '/home';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/home'; }
}

export function androidCallbackCode(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'barangayan:' || url.hostname !== 'auth' || url.pathname !== '/callback' || url.hash || url.username || url.password || url.port) throw new Error('Invalid authentication callback.');
  if (url.searchParams.has('error')) throw new Error('Google sign-in was cancelled or declined. Please try again.');
  const codes = url.searchParams.getAll('code');
  if (codes.length !== 1 || !codes[0]) throw new Error('Authentication callback has expired or is incomplete. Please sign in again.');
  return codes[0];
}

/** Existing staff profiles retain their role; residents must supply required fields. */
export function residentProfileComplete(profile: Database['public']['Tables']['profiles']['Row'] | null): boolean {
  if (!profile || profile.deleted_at) return false;
  if (profile.role !== 'resident') return true;
  return profileCompletionSchema.safeParse({
    firstName: profile.first_name, lastName: profile.last_name,
    middleName: profile.middle_name || undefined, suffix: profile.suffix || undefined,
    houseNo: profile.house_no, street: profile.street, sex: profile.sex,
    employmentStatus: profile.employment_status, occupation: profile.occupation || undefined,
    mobileNumber: profile.mobile_number, birthDate: profile.birth_date,
  }).success;
}

export async function needsResidentProfile(client: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).abortSignal(controller.signal).maybeSingle();
    if (error) throw new Error('Unable to load your profile. Check your connection and retry.');
    return !residentProfileComplete(data);
  } finally { clearTimeout(timer); }
}

/** Configuration selects registration locality; no first-row tenant assignment. */
export async function registrationLocality(client: SupabaseClient<Database>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const { data: locality, error } = await client.from('barangay_localities').select('*').eq('resident_registration_enabled', true).abortSignal(controller.signal).single();
    if (error || !locality) throw new Error('Registration locality unavailable. Please retry.');
    const { data: barangay, error: boundaryError } = await client.from('barangays').select('id, boundary').eq('id', locality.barangay_id).abortSignal(controller.signal).single();
    if (boundaryError || !barangay) throw new Error('Registration boundary unavailable. Please retry.');
    return { ...barangay, name: locality.display_name, city: locality.city, province: locality.province };
  } finally { clearTimeout(timer); }
}
