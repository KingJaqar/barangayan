import { z } from 'zod';
import { EMAIL_REGEX, MOBILE_NUMBER_REGEX, type Database, type Json, type Tables } from '@barangayan/shared';

export const profilePatchSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your name.').max(150, 'Use at most 150 characters.').optional(),
  mobile_number: z.string().trim().max(11).regex(MOBILE_NUMBER_REGEX, 'Use an 11-digit number beginning with 09.').nullable().optional(),
  email: z.string().trim().max(254).regex(EMAIL_REGEX, 'Enter a valid contact email.').nullable().optional(),
  avatar_url: z.string().url().regex(/^https?:\/\//, 'Use an owned profile photo.').max(1024).nullable().optional(),
  first_name: z.string().trim().min(1, 'Enter your first name.').max(100).optional(),
  last_name: z.string().trim().min(1, 'Enter your last name.').max(100).optional(),
  middle_name: z.string().trim().max(100).nullable().optional(),
  suffix: z.string().trim().max(20).nullable().optional(),
  home_address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(150).nullable().optional(),
  province: z.string().trim().max(150).nullable().optional(),
  birth_date: z.string().date('Enter a valid date of birth.').refine(value => value <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future.').nullable().optional(),
  sex: z.enum(['male', 'female']).nullable().optional(),
  employment_status: z.enum(['employed', 'unemployed', 'student', 'self_employed', 'retired']).nullable().optional(),
  occupation: z.string().trim().max(150).nullable().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Change at least one field.');

export const profileSaveSchema = z.object({
  expected: z.string().datetime({ offset: true }),
  patch: profilePatchSchema,
}).strict();
export const challengeSchema = z.string().uuid();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export const PROFILE_FIELDS = 'id,barangay_id,role,deleted_at,full_name,first_name,last_name,middle_name,suffix,mobile_number,email,avatar_url,home_address,house_no,street,city,province,birth_date,sex,employment_status,occupation,email_verification_status,id_verification_status,location_verified,created_at,updated_at,theme_preference,font_preference,push_notifications_enabled' as const;
export type ProfileDetails = Pick<Tables<'profiles'>,
  'id' | 'barangay_id' | 'role' | 'deleted_at' | 'full_name' | 'first_name' | 'last_name' | 'middle_name' | 'suffix' |
  'mobile_number' | 'email' | 'avatar_url' | 'home_address' | 'house_no' | 'street' | 'city' | 'province' |
  'birth_date' | 'sex' | 'employment_status' | 'occupation' | 'email_verification_status' | 'id_verification_status' |
  'location_verified' | 'created_at' | 'updated_at' | 'theme_preference' | 'font_preference' | 'push_notifications_enabled'>;
export type StaffSummary = Pick<Tables<'barangay_officials'>, 'official_role' | 'is_active' | 'date_hired'>;
export type ResidentSection =
  | { state: 'none' | 'error'; message: string }
  | { state: 'unavailable'; message: string; residentId: string; linkedAt: string }
  | { state: 'linked'; profile: ProfileDetails; linkedAt: string; householdCount: number | null };
export type Outcome<T> = { ok: true; value: T; warning?: string } | {
  ok: false; code: 'validation' | 'access' | 'conflict' | 'unavailable' | 'rate_limit'; message: string;
};
export type ProfileDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      admin_resident_associations: {
        Row: { admin_id: string; resident_id: string; linked_at: string };
        Insert: never; Update: never; Relationships: [];
      };
    };
    Functions: Database['public']['Functions'] & {
      admin_update_own_profile: { Args: { p_patch: Json; p_expected: string }; Returns: string };
      admin_begin_resident_association: { Args: Record<string, never>; Returns: string };
      resident_prove_admin_association: { Args: { p_challenge: string }; Returns: boolean };
      admin_finish_resident_association: { Args: { p_challenge: string }; Returns: string };
      admin_unlink_resident_association: { Args: { p_resident: string; p_expected: string }; Returns: boolean };
      admin_cancel_resident_association: { Args: { p_challenge: string }; Returns: boolean };
      admin_profile_verify_fresh_session: { Args: Record<string, never>; Returns: boolean };
      admin_profile_access: { Args: Record<string, never>; Returns: string };
      admin_profile_resident_available: { Args: Record<string, never>; Returns: boolean };
    };
  };
};

export function hasStructuredName(profile: Pick<ProfileDetails, 'first_name' | 'middle_name' | 'last_name' | 'suffix'>) {
  return [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].some(part => Boolean(part?.trim()));
}

export function ownedAvatarPath(url: string | null, uid: string, apiUrl: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const prefix = `/storage/v1/object/public/profile-photos/${uid}/`;
    if (parsed.origin !== new URL(apiUrl).origin || parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.pathname.startsWith(prefix)) return null;
    const file = parsed.pathname.slice(prefix.length);
    return /^(?:[0-9a-f-]{36}|avatar)\.(jpg|jpeg|png|webp)$/i.test(file) ? `${uid}/${file}` : null;
  } catch { return null; }
}

export function profileFailure(code?: string): Outcome<never> {
  if (code === '42501' || code === 'PGRST301') return { ok: false, code: 'access', message: 'An active admin session is required. Sign in again.' };
  if (code === '40001' || code === 'PT409' || code === '23505') return { ok: false, code: 'conflict', message: 'These details changed or the association conflicts. Reload and review before trying again.' };
  if (code === '22023') return { ok: false, code: 'validation', message: 'The submitted information is invalid or the ownership proof expired. Review it and try again.' };
  if (code === '429' || code === 'PT429' || code === 'over_request_rate_limit') return { ok: false, code: 'rate_limit', message: 'Too many attempts. Wait a few minutes before trying again.' };
  return { ok: false, code: 'unavailable', message: 'Could not confirm the outcome. Reload current details before retrying.' };
}
