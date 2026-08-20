'use client';

/**
 * Profile form — migrated from apps/admin-web/src/app/resident/profile/profile-form.tsx
 * and heavily extended per Phase 7 spec:
 *  - Avatar upload (profile-photos bucket, C-040)
 *  - Household member CRUD (reuses useFamilyMembers from Phase 2, same hook, CC-003)
 *  - ID type picker + ID photo upload (id-documents bucket, C-041, signed-URL only)
 *  - Proper sex/employment selects (shadcn-style native selects for now — no RadioGroup needed)
 *
 * WRITE GUARDS (§7, C-001):
 *   - Do NOT include email_verification_status / email_verification_requested_at /
 *     email_verified_at in the UPDATE payload — guard_verification_fields trigger
 *     raises if those columns appear, failing the entire update.
 *   - Do NOT set id_verification_status = 'verified' — guard_id_verification_status
 *     raises. Residents may set 'pending' (re-uploading always resets to 'pending') or
 *     leave it untouched.
 *   - full_name / home_address are DERIVED by the compose_profiles_display_fields
 *     trigger (0081) from the structured columns — never include them in the payload.
 */

import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  SEXES,
  type EmploymentStatus,
  type Sex,
} from '@barangayan/shared';
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Camera,
  IdCard,
  MailCheck,
  MapPin,
  Plus,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { FamilyMemberDialog } from '@/components/emergency/family-member-dialog';
import { Button } from '@/components/ui/button';
import { getIdDocumentSignedUrl } from '@/actions/id-document-signed-url';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useFamilyMembers } from '@/hooks/use-family-members';
import { ACCEPTED_IMAGE_MIME_TYPES, imageExtension, isWithinSizeLimit } from '@/lib/image-upload';
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
  | 'email'
  | 'mobile_number'
  | 'house_no'
  | 'street'
  | 'city'
  | 'employment_status'
  | 'occupation'
  | 'id_verification_status'
  | 'avatar_url'
  | 'id_type'
  | 'id_photo_urls'
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

const ID_TYPES = [
  'PhilSys', 'Digital PhilSys', "Driver's License", 'Passport', 'SSS ID',
  "Voter's ID", 'PhilHealth ID', 'PRC ID', 'UMID', 'Postal ID',
  'Senior Citizen ID', 'PWD ID', 'GSIS ID', 'TIN ID', 'Barangay ID', 'Other',
] as const;

/** 5 MB — resident-web matches mobile's limit for id-documents. */
const MAX_ID_PHOTO_BYTES = 5 * 1024 * 1024;
/** 3 MB — for avatar photos. */
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

const inputCls =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
const labelCls = 'mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400';
const disabledCls =
  'w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950';
const cardCls =
  'rounded-xl border border-black/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900';

function CardHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-tint)] text-[var(--accent)]">
        {icon}
      </span>
      <h3 className="text-sm font-semibold">{children}</h3>
    </div>
  );
}

// ─── Email verification ─────────────────────────────────────────────────────

/**
 * Non-functional per spec — no email-verification API exists yet anywhere in this
 * codebase (see EmailVerifyBanner's own comment). Clicking "Verify Email" just tells
 * the resident it's not available instead of pretending to send anything.
 */
function EmailVerifyStatus({ status }: { status: string | null }) {
  const verified = status === 'verified';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
      <span
        className={`flex items-center gap-1.5 text-xs font-semibold ${
          verified ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
        }`}>
        {verified ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}
        {verified ? 'Email verified' : 'Email not verified'}
      </span>
      {!verified ? (
        <button
          type="button"
          onClick={() => toast('Email verification isn’t available yet. Check back soon.')}
          className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent)]/40 px-2.5 py-1 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-tint)]">
          <MailCheck size={12} /> Verify Email
        </button>
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
    <div className="flex shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-2xl font-bold text-white ring-2 ring-[var(--accent)]/30 transition hover:ring-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Profile photo" className="h-full w-full object-cover" />
        ) : (
          <span className="select-none text-2xl">👤</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
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
        className="text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-50">
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

// ─── ID Document section ──────────────────────────────────────────────────────

function IdDocumentSection({
  profileId,
  idType: initialIdType,
  idPhotoUrls: initialUrls,
  verificationStatus,
}: {
  profileId: string;
  idType: string | null;
  idPhotoUrls: string[] | null;
  verificationStatus: string | null;
}) {
  const [idType, setIdType] = useState(initialIdType ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const statusLabel =
    verificationStatus === 'verified' ? 'Verified ✓' :
    verificationStatus === 'pending' ? 'Pending Review' : 'Not Submitted';

  const statusColor =
    verificationStatus === 'verified' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' :
    verificationStatus === 'pending' ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' :
    'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';

  async function handleIdUpload(file: File) {
    if (!isWithinSizeLimit(file, MAX_ID_PHOTO_BYTES)) {
      toast.error('File too large (max 5 MB).');
      return;
    }
    if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const timestamp = Date.now();
    const path = `${profileId}/id-${timestamp}.${imageExtension(file.type)}`;
    const { error: upErr } = await supabase.storage.from('id-documents').upload(path, file, { upsert: false });
    if (upErr) {
      toast.error(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    // Reset to 'pending' on re-upload (guard_id_verification_status trigger allows this
    // but rejects 'verified' — see §7 write guards note above).
    const newUrls = [...photoUrls, path];
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ id_photo_urls: newUrls, id_verification_status: 'pending' })
      .eq('id', profileId);
    if (updateErr) {
      toast.error(`Failed to save ID: ${updateErr.message}`);
    } else {
      setPhotoUrls(newUrls);
      toast.success('ID document uploaded. Your verification status has been reset to Pending Review.');
      router.refresh();
    }
    setUploading(false);
  }

  async function handleSaveIdType() {
    if (!idType) return;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('profiles').update({ id_type: idType }).eq('id', profileId);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      toast.success('ID type saved.');
    }
    setSaving(false);
  }

  async function viewIdPhoto(path: string) {
    setLoadingSignedUrl(true);
    const result = await getIdDocumentSignedUrl(path);
    setLoadingSignedUrl(false);
    if (result.error || !result.url) {
      toast.error(result.error ?? 'Could not load photo.');
      return;
    }
    setSignedUrl(result.url);
  }

  return (
    <div className={`${cardCls} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-tint)] text-[var(--accent)]">
            <IdCard size={15} />
          </span>
          <h3 className="text-sm font-semibold">ID Verification</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
      </div>

      <div>
        <label className={labelCls}>ID Type</label>
        <div className="flex gap-2">
          <select value={idType} onChange={(e) => setIdType(e.target.value)} className={`${inputCls} flex-1`}>
            <option value="">Select ID type…</option>
            {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button type="button" onClick={handleSaveIdType} disabled={saving || !idType || idType === (initialIdType ?? '')} size="sm" variant="outline">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div>
        <label className={labelCls}>ID Photo{photoUrls.length > 0 ? ` (${photoUrls.length} uploaded)` : ''}</label>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Upload a clear photo of your government-issued ID. Stored privately — only you and barangay staff can view it.
        </p>
        <div className="flex flex-wrap gap-2">
          {photoUrls.map((path, i) => (
            <button
              key={path}
              type="button"
              onClick={() => viewIdPhoto(path)}
              disabled={loadingSignedUrl}
              className="flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 text-xs text-zinc-500 transition hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800">
              {loadingSignedUrl ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" /> : `ID ${i + 1}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-zinc-400 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 dark:border-zinc-700">
            {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" /> : <><Upload size={16} /><span className="text-[10px]">Upload</span></>}
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIdUpload(f); e.target.value = ''; }} />
      </div>

      {/* Signed URL preview modal */}
      {signedUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSignedUrl(null)}>
          <div className="relative max-h-[80vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signedUrl} alt="ID document" className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-2xl" />
            <button onClick={() => setSignedUrl(null)} className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md dark:bg-zinc-800">
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Household members section ─────────────────────────────────────────────────

function HouseholdSection({ profileId }: { profileId: string }) {
  const { members, isLoading, addMember, updateMember, removeMember } = useFamilyMembers(profileId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof members)[0] | null>(null);

  async function handleSave(data: { id?: string; name: string; relation: string; role: string }) {
    if (data.id) {
      await updateMember(data.id, { name: data.name, relation: data.relation, role: data.role });
      toast.success('Member updated.');
    } else {
      await addMember({ name: data.name, relation: data.relation, role: data.role });
      toast.success('Member added.');
    }
    setDialogOpen(false);
    setEditing(null);
  }

  async function handleRemove(id: string) {
    await removeMember(id);
    toast.success('Member removed.');
  }

  return (
    <div className={`${cardCls} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-tint)] text-[var(--accent)]">
            <Users size={15} />
          </span>
          <h3 className="text-sm font-semibold">Household Members</h3>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />)}
        </div>
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
                <button type="button" onClick={() => { setEditing(m); setDialogOpen(true); }}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700">Edit</button>
                <button type="button" onClick={() => handleRemove(m.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FamilyMemberDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        onDelete={editing ? (id) => { handleRemove(id); setDialogOpen(false); setEditing(null); } : undefined}
      />
    </div>
  );
}

// ─── Main form ──────────────────────────────────────────────────────────────────

export function ProfileForm({ profile, barangayName }: { profile: ProfileFields; barangayName: string }) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [lastName, setLastName] = useState(profile.last_name ?? '');
  const [middleName, setMiddleName] = useState(profile.middle_name ?? '');
  const [suffix, setSuffix] = useState(profile.suffix ?? '');
  const [sex, setSex] = useState<Sex | ''>((profile.sex as Sex | null) ?? '');
  const [mobileNumber, setMobileNumber] = useState(profile.mobile_number ?? '');
  const [houseNo, setHouseNo] = useState(profile.house_no ?? '');
  const [street, setStreet] = useState(profile.street ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | ''>(
    (profile.employment_status as EmploymentStatus | null) ?? '',
  );
  const [occupation, setOccupation] = useState(profile.occupation ?? '');
  const [saving, setSaving] = useState(false);

  const isDirty =
    firstName !== (profile.first_name ?? '') ||
    lastName !== (profile.last_name ?? '') ||
    middleName !== (profile.middle_name ?? '') ||
    suffix !== (profile.suffix ?? '') ||
    sex !== ((profile.sex as Sex | null) ?? '') ||
    mobileNumber !== (profile.mobile_number ?? '') ||
    houseNo !== (profile.house_no ?? '') ||
    street !== (profile.street ?? '') ||
    city !== (profile.city ?? '') ||
    employmentStatus !== ((profile.employment_status as EmploymentStatus | null) ?? '') ||
    occupation !== (profile.occupation ?? '');

  const showOccupation = employmentStatus !== '' && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus as EmploymentStatus);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;
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
        mobile_number: mobileNumber.trim() || null,
        house_no: houseNo.trim() || null,
        street: street.trim() || null,
        city: city.trim() || null,
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
    <div className="space-y-4">
      {/* Identity summary: avatar + name + email verification, compact horizontal card */}
      <div className={`${cardCls} flex flex-col items-center gap-4 sm:flex-row`}>
        <AvatarSection profileId={profile.id} currentUrl={profile.avatar_url ?? null} />
        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          <div>
            <p className="truncate text-base font-semibold">
              {[firstName, lastName].filter(Boolean).join(' ') || 'Resident'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{barangayName}</p>
          </div>
          <EmailVerifyStatus status={profile.email_verification_status ?? null} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
        {/* Personal info / address / employment */}
        <form onSubmit={handleSave} className={`${cardCls} space-y-4`}>
          <CardHeading icon={<UserIcon size={15} />}>Personal Information</CardHeading>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <label className="text-sm">
              <span className={labelCls}>First Name</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className={labelCls}>Last Name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className={labelCls}>Middle Name</span>
              <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className={labelCls}>Suffix</span>
              <input value={suffix} onChange={(e) => setSuffix(e.target.value)} className={inputCls} placeholder="Jr., III" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className={labelCls}>Sex</span>
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')} className={inputCls}>
                <option value="">Select sex</option>
                {SEXES.map((s) => <option key={s} value={s}>{SEX_LABELS[s]}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className={labelCls}>Mobile Number</span>
              <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className={inputCls} />
            </label>
            <div className="text-sm">
              <span className={labelCls}>Email</span>
              <input value={profile.email ?? ''} disabled title="Contact barangay staff to change your email." className={disabledCls} />
            </div>
          </div>

          <hr className="border-black/[0.06] dark:border-white/[0.06]" />
          <CardHeading icon={<MapPin size={15} />}>Home Address</CardHeading>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className={labelCls}>House No.</span>
              <input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className={labelCls}>Street</span>
              <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className={labelCls}>City</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </label>
          </div>

          {/* Barangay is read-only — assigned at registration, not editable by the resident. */}
          <div className="text-sm">
            <span className={labelCls}>Barangay</span>
            <input value={barangayName} disabled className={disabledCls} />
          </div>

          <hr className="border-black/[0.06] dark:border-white/[0.06]" />
          <CardHeading icon={<Briefcase size={15} />}>Employment</CardHeading>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className={labelCls}>Employment Status</span>
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
            </label>

            {showOccupation ? (
              <label className="text-sm">
                <span className={labelCls}>Occupation</span>
                <input value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputCls} placeholder="Optional" />
              </label>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {isDirty ? <p className="text-xs text-zinc-400">You have unsaved changes.</p> : <span />}
            <button
              type="submit"
              disabled={saving || !isDirty}
              className="self-start rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Household + ID verification */}
        <div className="space-y-4">
          <HouseholdSection profileId={profile.id} />
          <IdDocumentSection
            profileId={profile.id}
            idType={profile.id_type ?? null}
            idPhotoUrls={Array.isArray(profile.id_photo_urls) ? (profile.id_photo_urls as string[]) : null}
            verificationStatus={profile.id_verification_status ?? null}
          />
        </div>
      </div>
    </div>
  );
}
