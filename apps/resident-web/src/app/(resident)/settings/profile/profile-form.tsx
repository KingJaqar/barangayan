'use client';

/**
 * Profile form — migrated from apps/admin-web/src/app/resident/profile/profile-form.tsx
 * and heavily extended per Phase 7 spec:
 *  - Avatar upload (profile-photos bucket, C-040)
 *  - Household member CRUD (reuses useFamilyMembers from Phase 2, same hook, CC-003)
 *  - Proper sex/employment selects (shadcn-style native selects for now — no RadioGroup needed)
 *
 * WRITE GUARDS (§7, C-001):
 *   - Do NOT include email_verification_status / email_verification_requested_at /
 *     email_verified_at in the UPDATE payload — guard_verification_fields trigger
 *     raises if those columns appear, failing the entire update.
 *   - Evidence and verification fields use the version publication/review RPCs.
 *     Ordinary profile updates leave approval untouched.
 *   - full_name / home_address are DERIVED by the compose_profiles_display_fields
 *     trigger (0081) from the structured columns — never include them in the payload.
 */

import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  MOBILE_NUMBER_REGEX,
  NAME_REGEX,
  SEXES,
  type EmploymentStatus,
  type Sex,
} from '@barangayan/shared';
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  MailCheck,
  MapPin,
  Plus,
  Trash2,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from '@/components/birthday-calendar-modal';
import { FamilyMemberDialog } from '@/components/emergency/family-member-dialog';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Skeleton, Spinner } from '@/components/ui/loading';
import { useFamilyMembers } from '@/hooks/use-family-members';
import { notifyHouseholdOutcome } from '@/lib/household-feedback';
import { beginAttempt } from '@/lib/notify';
import { ACCEPTED_IMAGE_MIME_TYPES, imageExtension, isWithinSizeLimit } from '@/lib/image-upload';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Tables } from '@barangayan/shared';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ProfileFields = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'middle_name'
  | 'suffix'
  | 'sex'
  | 'birth_date'
  | 'email'
  | 'mobile_number'
  | 'house_no'
  | 'street'
  | 'city'
  | 'province'
  | 'employment_status'
  | 'occupation'
  | 'avatar_url'
  | 'barangay_id'
  | 'household_members'
  | 'email_verification_status'
> & {
  barangays: Pick<Tables<'barangays'>, 'name'> | null;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female' };

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  unemployed: 'Unemployed',
  student: 'Student',
  self_employed: 'Self-Employed',
  retired: 'Retired',
};

/** YYYY-MM-DD → "August 8, 2000" */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return isoToLocalDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Live per-field validation ────────────────────────────────────────────────
// Same rules/shape as the Register screen's fieldStatus/validate* helpers
// (register-form.tsx) and mobile's profile.tsx — a red alert or a green check
// appears below a field the moment its value becomes invalid/valid, as-you-type.
function validateName(value: string): string | null {
  return NAME_REGEX.test(value) ? null : 'Letters only — no numbers or symbols';
}
function validateMobileNumber(value: string): string | null {
  return MOBILE_NUMBER_REGEX.test(value) ? null : 'Enter an 11-digit mobile number (e.g. 09171234567)';
}
/**
 * Resolves a field's error/success pair:
 *  - empty value  → whatever the last Save Changes attempt reported (or nothing yet)
 *  - non-empty    → live format check, so feedback appears as the resident types
 */
function fieldStatus(
  value: string,
  submitError: string | undefined,
  validate?: (value: string) => string | null,
  successMessage = ' ',
): { error?: string; success?: string } {
  if (!value) return submitError ? { error: submitError } : {};
  const message = validate?.(value);
  if (message) return { error: message };
  return { success: successMessage };
}

/** Red asterisk suffix for required-field labels. */
function RequiredMark() {
  return <span className="text-red-500"> *</span>;
}

/** Red-alert / green-check row rendered below a field. */
function FieldStatus({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
        <AlertCircle size={12} />
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 size={12} />
        {success}
      </p>
    );
  }
  return null;
}

/** 3 MB — for avatar photos. */
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

const inputCls =
  'min-w-0 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)] focus:bg-white aria-invalid:border-red-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:bg-zinc-800';
const labelCls = 'mb-2 block text-xs font-semibold text-zinc-600 dark:text-zinc-400';
const disabledCls =
  'min-w-0 w-full rounded-xl border-2 border-zinc-200 bg-zinc-100/70 px-3 py-2.5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950';
const cardCls =
  'min-w-0 rounded-2xl border-2 border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40';

function CardHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-tint)] text-[var(--accent)]">
        {icon}
      </span>
      <h3 className="text-sm font-bold tracking-tight">{children}</h3>
    </div>
  );
}

// ─── Email verification ─────────────────────────────────────────────────────

/** Protected email-code flow lives in Settings; residents never write badges. */
function EmailVerifyStatus({ status }: { status: string | null }) {
  const verified = status === 'verified';
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
      <span
        className={`flex items-center gap-1.5 text-xs font-semibold ${
          verified ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
        }`}>
        {verified ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}
        {verified ? 'Email verified' : 'Email not verified'}
      </span>
      {!verified ? (
        <Link
          href="/settings/email-verification"
          className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent)]/40 px-2.5 py-1 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-tint)]">
          <MailCheck size={12} /> Verify Email
        </Link>
      ) : null}
    </div>
  );
}

// ─── Avatar section ─────────────────────────────────────────────────────────────

function AvatarSection({ profileId, currentUrl }: { profileId: string; currentUrl: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    if (!isWithinSizeLimit(file, MAX_AVATAR_BYTES)) {
      toast.error('Photo is too large (max 3 MB).');
      return;
    }
    if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `${profileId}/avatar.${imageExtension(file.type)}`;
    const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: true });
    if (upErr) {
      toast.error(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
    const newUrl = urlData.publicUrl;
    const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', profileId);
    if (updateErr) {
      toast.error(`Failed to save avatar: ${updateErr.message}`);
    } else {
      setPreviewUrl(newUrl + `?t=${Date.now()}`);
      toast.success('Profile photo updated.');
      router.refresh();
    }
    setUploading(false);
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile photo"
        className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] disabled:opacity-60 sm:h-32 sm:w-32">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Profile photo" className="h-full w-full object-cover" />
        ) : (
          <UserIcon aria-hidden size={44} strokeWidth={1.5} />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera size={22} className="text-white" />
        </span>
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-xl border-2 border-zinc-200 border-b-[3px] px-3 py-2 text-xs font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent-tint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 dark:border-zinc-700">
        {uploading ? 'Uploading…' : 'Change Photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Household section ──────────────────────────────────────────────────────

function HouseholdSection({ profileId }: { profileId: string }) {
  const { members, isInitialLoading, isReady, error, refetch, addMember, updateMember, removeMember, lastWriteFailure } = useFamilyMembers(profileId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof members)[0] | null>(null);
  // Id of the member whose inline Remove is in flight; also blocks other roster edits so
  // two whole-roster writes never overlap.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removingRef = useRef(false);

  // Each handler reports success only from the write's own result and returns it, so the
  // dialog stays open (inputs kept) on failure. This screen owns the one notification.
  async function finish(action: 'add' | 'update' | 'remove', write: () => Promise<boolean>): Promise<boolean> {
    const attempt = beginAttempt(`household-${action}`);
    let ok = false;
    try {
      ok = await write();
    } catch {
      ok = false;
    }
    const failure = ok ? null : lastWriteFailure();
    notifyHouseholdOutcome(action, ok, failure, attempt);
    if (failure === 'unconfirmed') refetch();
    return ok;
  }

  function handleSave(data: { id?: string; name: string; relation: string; role: string }): Promise<boolean> {
    const { id } = data;
    return id
      ? finish('update', async () => (await updateMember(id, { name: data.name, relation: data.relation, role: data.role })) !== null)
      : finish('add', async () => (await addMember({ name: data.name, relation: data.relation, role: data.role })) !== null);
  }

  function handleRemove(id: string): Promise<boolean> {
    return finish('remove', () => removeMember(id));
  }

  async function handleInlineRemove(id: string) {
    if (removingRef.current) return;
    removingRef.current = true;
    setRemovingId(id);
    try {
      await handleRemove(id);
    } finally {
      removingRef.current = false;
      setRemovingId(null);
    }
  }

  return (
    <div className={`${cardCls} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-tint)] text-[var(--accent)]">
            <Users size={15} />
          </span>
          <h3 className="text-sm font-bold">Household Members</h3>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={removingId !== null || !isReady} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
      </div>

      {isReady && error ? (
        <InlineReadError
          tone="warning"
          message="Couldn't update the household list. Showing the last loaded list, which may be out of date."
          onRetry={refetch}
        />
      ) : null}

      {isInitialLoading ? (
        <div aria-busy className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      ) : !isReady ? (
        <InlineReadError message="We couldn't load your household members. Check your connection, then try again." onRetry={refetch} />
      ) : members.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No household members added yet.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{[m.relation, m.role].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" disabled={removingId !== null} onClick={() => { setEditing(m); setDialogOpen(true); }}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 disabled:opacity-50 dark:hover:bg-zinc-700">Edit</button>
                <button type="button" disabled={removingId !== null} aria-busy={removingId === m.id || undefined}
                  aria-label={`Remove ${m.name}`} onClick={() => void handleInlineRemove(m.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/20">
                  {removingId === m.id ? <Spinner delayed={false} className="size-3" /> : <Trash2 size={12} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <LoadingStatus active={isInitialLoading} label="Loading household members…" />

      <FamilyMemberDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        onDelete={editing ? handleRemove : undefined}
      />
    </div>
  );
}

// ─── Main form ──────────────────────────────────────────────────────────────────

export function ProfileForm({ profile, barangayName, fixedLocality = false }: { profile: ProfileFields; barangayName: string; fixedLocality?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const handoff = () => {
      if (window.location.hash === '#upload-valid-id') router.replace('/settings/valid-id');
    };
    handoff();
    window.addEventListener('hashchange', handoff);
    return () => window.removeEventListener('hashchange', handoff);
  }, [router]);

  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [lastName, setLastName] = useState(profile.last_name ?? '');
  const [middleName, setMiddleName] = useState(profile.middle_name ?? '');
  const [suffix, setSuffix] = useState(profile.suffix ?? '');
  const [sex, setSex] = useState<Sex | ''>((profile.sex as Sex | null) ?? '');
  const [birthDateIso, setBirthDateIso] = useState<string | null>(profile.birth_date ?? null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [mobileNumber, setMobileNumber] = useState(profile.mobile_number ?? '');
  const [houseNo, setHouseNo] = useState(profile.house_no ?? '');
  const [street, setStreet] = useState(profile.street ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | ''>(
    (profile.employment_status as EmploymentStatus | null) ?? '',
  );
  const [occupation, setOccupation] = useState(profile.occupation ?? '');
  const [saving, setSaving] = useState(false);
  // Populated by validateRequiredFields() on a Save Changes attempt — drives the red
  // "required" / format messages shown under empty or invalid required fields. Format
  // errors on non-empty values are also caught live, as-you-type, via fieldStatus()
  // below — this additionally catches fields left empty.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isDirty =
    firstName !== (profile.first_name ?? '') ||
    lastName !== (profile.last_name ?? '') ||
    middleName !== (profile.middle_name ?? '') ||
    suffix !== (profile.suffix ?? '') ||
    sex !== ((profile.sex as Sex | null) ?? '') ||
    birthDateIso !== (profile.birth_date ?? null) ||
    mobileNumber !== (profile.mobile_number ?? '') ||
    houseNo !== (profile.house_no ?? '') ||
    street !== (profile.street ?? '') ||
    city !== (profile.city ?? '') ||
    employmentStatus !== ((profile.employment_status as EmploymentStatus | null) ?? '') ||
    occupation !== (profile.occupation ?? '');

  const showOccupation = employmentStatus !== '' && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus as EmploymentStatus);

  // Live status for every field with a format check — computed once per render so the
  // input's aria-invalid and the FieldStatus row below it never disagree. Mirrors the
  // Register screen's identical treatment (register-form.tsx).
  const firstNameStatus = fieldStatus(firstName, fieldErrors.firstName, validateName);
  const lastNameStatus = fieldStatus(lastName, fieldErrors.lastName, validateName);
  const middleNameStatus = fieldStatus(middleName, fieldErrors.middleName, validateName);
  const suffixStatus = fieldStatus(suffix, fieldErrors.suffix, validateName);
  const mobileNumberStatus = fieldStatus(mobileNumber, fieldErrors.mobileNumber, validateMobileNumber);
  const houseNoStatus = fieldStatus(houseNo, fieldErrors.houseNo);
  const streetStatus = fieldStatus(street, fieldErrors.street);

  /** Required-field / format validation, run on every Save Changes attempt. */
  function validateRequiredFields(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = 'First name is required';
    else if (!NAME_REGEX.test(firstName)) errors.firstName = 'Letters only — no numbers or symbols';

    if (!lastName.trim()) errors.lastName = 'Last name is required';
    else if (!NAME_REGEX.test(lastName)) errors.lastName = 'Letters only — no numbers or symbols';

    if (middleName.trim() && !NAME_REGEX.test(middleName)) errors.middleName = 'Letters only — no numbers or symbols';
    if (suffix.trim() && !NAME_REGEX.test(suffix)) errors.suffix = 'Letters only — no numbers or symbols';

    if (!sex) errors.sex = 'Select your sex';
    if (!birthDateIso) errors.birthDate = 'Date of birth is required';

    if (!mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required';
    else if (!MOBILE_NUMBER_REGEX.test(mobileNumber)) errors.mobileNumber = 'Enter an 11-digit mobile number (e.g. 09171234567)';

    if (!houseNo.trim()) errors.houseNo = 'House No. is required';
    if (!street.trim()) errors.street = 'Street is required';
    if (!city.trim()) errors.city = 'City is required';
    if (!employmentStatus) errors.employmentStatus = 'Select employment status';

    return errors;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;

    const errors = validateRequiredFields();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setFieldErrors({});

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    // ⚠️ WRITE GUARDS: email_verification_* and id_verification_status='verified' are
    // explicitly excluded from this payload — the DB triggers raise if they appear (§7).
    // full_name / home_address are also excluded — derived by trigger 0081.
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        middle_name: middleName.trim() || null,
        suffix: suffix.trim() || null,
        sex: sex || null,
        birth_date: birthDateIso,
        mobile_number: mobileNumber.trim() || null,
        house_no: houseNo.trim() || null,
        street: street.trim() || null,
        ...(!fixedLocality ? { city: city.trim() || null } : {}),
        employment_status: employmentStatus || null,
        occupation: occupation.trim() || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    toast.success('Profile updated.');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <BirthdayCalendarModal
        open={showBirthPicker}
        value={birthDateIso ? isoToLocalDate(birthDateIso) : null}
        onClose={() => setShowBirthPicker(false)}
        onSave={(date) => {
          setBirthDateIso(dateToIso(date));
          setShowBirthPicker(false);
        }}
      />

      {/* Identity header separated from the editable sections below. */}
      <div className="flex flex-col items-center gap-6 border-b-2 border-zinc-200 pb-8 sm:flex-row dark:border-zinc-800">
        <AvatarSection profileId={profile.id} currentUrl={profile.avatar_url ?? null} />
        <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
          <div>
            <h2 className="break-words text-2xl font-bold tracking-tight">
              {[firstName, lastName].filter(Boolean).join(' ') || 'Resident'}
            </h2>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-zinc-500 sm:justify-start dark:text-zinc-400"><MapPin aria-hidden size={14} />{barangayName}</p>
          </div>
          <EmailVerifyStatus status={profile.email_verification_status ?? null} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)] xl:items-start">
        {/* Personal info / address / employment */}
        <form onSubmit={handleSave} className="min-w-0 space-y-6">
          <section className={`${cardCls} space-y-5`}>
            <CardHeading icon={<UserIcon size={15} />}>Personal Information</CardHeading>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className={labelCls}>
                  First Name
                  <RequiredMark />
                </span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} aria-invalid={!!firstNameStatus.error} />
                <FieldStatus {...firstNameStatus} />
              </label>
              <label className="text-sm">
                <span className={labelCls}>
                  Last Name
                  <RequiredMark />
                </span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} aria-invalid={!!lastNameStatus.error} />
                <FieldStatus {...lastNameStatus} />
              </label>
              <label className="text-sm">
                <span className={labelCls}>Middle Name</span>
                <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputCls} aria-invalid={!!middleNameStatus.error} />
                <FieldStatus {...middleNameStatus} />
              </label>
              <label className="text-sm">
                <span className={labelCls}>Suffix</span>
                <input value={suffix} onChange={(e) => setSuffix(e.target.value)} className={inputCls} placeholder="Jr., III" aria-invalid={!!suffixStatus.error} />
                <FieldStatus {...suffixStatus} />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className={labelCls}>
                  Sex
                  <RequiredMark />
                </span>
                <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')} className={inputCls}>
                  <option value="">Select sex</option>
                  {SEXES.map((s) => <option key={s} value={s}>{SEX_LABELS[s]}</option>)}
                </select>
                {fieldErrors.sex ? <FieldStatus error={fieldErrors.sex} /> : sex ? <FieldStatus success=" " /> : null}
              </label>
              <label className="text-sm">
                <span className={labelCls}>
                  Mobile Number
                  <RequiredMark />
                </span>
                <div className="flex items-stretch">
                  <span className="flex items-center rounded-l-xl border-2 border-r-0 border-zinc-200 bg-zinc-100/70 px-2.5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    +63
                  </span>
                  <input
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, ''))}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="09171234567"
                    className={`${inputCls} rounded-l-none`}
                    aria-invalid={!!mobileNumberStatus.error}
                  />
                </div>
                <FieldStatus {...mobileNumberStatus} />
              </label>
              <div className="text-sm sm:col-span-2">
                <label htmlFor="profile-email" className={labelCls}>
                  Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={profile.email ?? ''}
                  disabled
                  className={`${disabledCls} cursor-not-allowed`}
                />
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/settings/email-verification?changeEmail=1">Change email address</Link>
                </Button>
              </div>
            </div>

            <div className="text-sm sm:w-1/2">
              <span className={labelCls}>
                Date of Birth
                <RequiredMark />
              </span>
              <button
                type="button"
                onClick={() => setShowBirthPicker(true)}
                className={`${inputCls} flex items-center justify-between text-left`}>
                <span className={birthDateIso ? undefined : 'text-zinc-400'}>
                  {birthDateIso ? fmtDate(birthDateIso) : 'Select date of birth'}
                </span>
                <CalendarIcon size={14} className="shrink-0 text-zinc-400" />
              </button>
              {fieldErrors.birthDate ? <FieldStatus error={fieldErrors.birthDate} /> : birthDateIso ? <FieldStatus success=" " /> : null}
            </div>

          </section>
          <section className={`${cardCls} space-y-5`}>
            <CardHeading icon={<MapPin size={15} />}>Home Address</CardHeading>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className={labelCls}>
                  House No.
                  <RequiredMark />
                </span>
                <input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} className={inputCls} aria-invalid={!!houseNoStatus.error} />
                <FieldStatus {...houseNoStatus} />
              </label>
              <label className="text-sm">
                <span className={labelCls}>
                  Street
                  <RequiredMark />
                </span>
                <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} aria-invalid={!!streetStatus.error} />
                <FieldStatus {...streetStatus} />
              </label>
              <label className="text-sm">
                <span className={labelCls}>
                  City
                  <RequiredMark />
                </span>
                <input aria-label="City" value={city} readOnly={fixedLocality} onChange={event => setCity(event.target.value)} className={fixedLocality ? disabledCls : inputCls} />
              </label>
            </div>

            {/* Barangay is read-only — assigned at registration, not editable by the resident. */}
            <div className="text-sm">
              <span className={labelCls}>Barangay</span>
              <input aria-label="Barangay" value={barangayName} readOnly className={disabledCls} />
            </div>
            <div className="text-sm">
              <span className={labelCls}>Province</span>
              <input aria-label="Province" value={profile.province ?? 'Not configured'} readOnly className={disabledCls} />
            </div>

          </section>
          <section className={`${cardCls} space-y-5`}>
            <CardHeading icon={<Briefcase size={15} />}>Employment</CardHeading>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className={labelCls}>
                  Employment Status
                  <RequiredMark />
                </span>
                <select
                  value={employmentStatus}
                  onChange={(e) => {
                    const next = e.target.value as EmploymentStatus | '';
                    setEmploymentStatus(next);
                    if (!next || !EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(next as EmploymentStatus)) setOccupation('');
                  }}
                  className={inputCls}>
                  <option value="">Select employment status</option>
                  {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{EMPLOYMENT_STATUS_LABELS[s]}</option>)}
                </select>
                {fieldErrors.employmentStatus ? (
                  <FieldStatus error={fieldErrors.employmentStatus} />
                ) : employmentStatus ? (
                  <FieldStatus success=" " />
                ) : null}
              </label>

              {showOccupation ? (
                <label className="text-sm">
                  <span className={labelCls}>Occupation</span>
                  <input value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputCls} placeholder="Optional" />
                </label>
              ) : null}
            </div>

          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-zinc-200 pt-5 dark:border-zinc-800">
            {isDirty ? <p className="text-xs text-zinc-400">You have unsaved changes.</p> : <span />}
            <button
              type="submit"
              disabled={saving || !isDirty}
              className="self-start rounded-xl border-b-[3px] border-[var(--accent-strong)] bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Household */}
        <div className="min-w-0 space-y-6">
          <HouseholdSection profileId={profile.id} />

        </div>
      </div>
    </div>
  );
}
