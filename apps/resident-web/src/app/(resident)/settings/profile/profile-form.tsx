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
  EMAIL_REGEX,
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
  Check,
  CheckCircle2,
  ChevronDown,
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
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getIdDocumentSignedUrl } from '@/actions/id-document-signed-url';
import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from '@/components/birthday-calendar-modal';
import { FamilyMemberDialog } from '@/components/emergency/family-member-dialog';
import { Button } from '@/components/ui/button';
import { useFamilyMembers } from '@/hooks/use-family-members';
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

/** profiles.id_type has no enum constraint — when the resident picks "Other" we persist
 * their exact ID name under this prefix (e.g. "Other: Barangay Certification") instead
 * of adding a new column, and strip it back off when re-populating the form. */
const OTHER_ID_TYPE_PREFIX = 'Other: ';

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
function validateEmail(value: string): string | null {
  return EMAIL_REGEX.test(value) ? null : 'Enter a valid email address';
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

/** Which side of the ID a stored id-documents path belongs to, based on the
 * `id-front.<ext>` / `id-back.<ext>` filename convention used by handleUpload below. */
function idPhotoSide(path: string): 'front' | 'back' | null {
  const name = path.split('/').pop() ?? '';
  if (name.startsWith('id-front.')) return 'front';
  if (name.startsWith('id-back.')) return 'back';
  return null;
}

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

/** One upload slot for a single ID side — exactly one photo each for Front/Back;
 * re-uploading replaces it in place (handleUpload below uses upsert:true against a
 * fixed `id-front`/`id-back` path, never accumulating extra files). The photo itself
 * renders inline via its signed URL — no click needed to see it — and shows a
 * top-right "×" only while it's a staged, not-yet-saved upload (isStaged). */
function IdPhotoSlot({
  label,
  path,
  signedUrl,
  uploading,
  isStaged,
  onUpload,
  onRemoveStaged,
  onView,
}: {
  label: string;
  path: string | null;
  signedUrl: string | null;
  uploading: boolean;
  isStaged: boolean;
  onUpload: (file: File) => void;
  onRemoveStaged: () => void;
  onView: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex-1 space-y-1.5">
      <p className={labelCls}>{label}</p>
      {path ? (
        <div className="relative">
          <button
            type="button"
            onClick={onView}
            className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
            {signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signedUrl} alt={`${label} of ID document`} className="h-full w-full object-cover" />
            ) : (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            )}
          </button>
          {isStaged ? (
            <button
              type="button"
              onClick={onRemoveStaged}
              aria-label={`Remove uploaded ${label.toLowerCase()} photo`}
              title="Remove this upload"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
              <X size={11} />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-zinc-400 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 dark:border-zinc-700">
          {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" /> : <><Upload size={16} /><span className="text-[10px]">Upload</span></>}
        </button>
      )}
      {path ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 dark:border-zinc-700">
          {uploading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" /> : <><Upload size={12} /> Reupload</>}
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Bottom-sheet style picker for ID Type — capped at 50% of the viewport height (never
 * covers the whole screen, per spec) with its own vertical scroll, sliding up from the
 * bottom on open and back down on close. Mirrors the shape of the mobile app's
 * SlideSheetModal/IdTypeModal (react-native-reanimated there; a CSS transition here). */
function IdTypeSheet({
  open,
  current,
  onClose,
  onSelect,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let raf: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => {
      if (open) {
        setMounted(true);
        // Deferred another tick so the initial (offscreen) transform actually paints
        // before switching to translate-y-0 — otherwise both style changes land in the
        // same frame and the slide-up never animates.
        raf = requestAnimationFrame(() => setEntered(true));
      } else {
        setEntered(false);
        timeout = setTimeout(() => setMounted(false), 200);
      }
    });
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Select ID type">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        style={{ maxHeight: '50vh' }}
        className={`relative flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl transition-transform duration-200 ease-out dark:bg-zinc-900 sm:mb-6 sm:max-w-md sm:rounded-2xl ${
          entered ? 'translate-y-0' : 'translate-y-full'
        }`}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
          <h4 className="text-sm font-semibold">Select ID Type</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {ID_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onSelect(t);
                onClose();
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <span className={current === t ? 'font-semibold text-[var(--accent)]' : ''}>{t}</span>
              {current === t ? <Check size={16} className="text-[var(--accent)]" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IdDocumentSection({
  profileId,
  idType: initialIdTypeRaw,
  idPhotoUrls: initialUrls,
  verificationStatus,
}: {
  profileId: string;
  idType: string | null;
  idPhotoUrls: string[] | null;
  verificationStatus: string | null;
}) {
  const initialIsOther = (initialIdTypeRaw ?? '').startsWith(OTHER_ID_TYPE_PREFIX);
  const [idType, setIdType] = useState(initialIsOther ? 'Other' : (initialIdTypeRaw ?? ''));
  const [otherType, setOtherType] = useState(initialIsOther ? (initialIdTypeRaw as string).slice(OTHER_ID_TYPE_PREFIX.length) : '');

  const initialFrontPath = (initialUrls ?? []).find((p) => idPhotoSide(p) === 'front') ?? null;
  const initialBackPath = (initialUrls ?? []).find((p) => idPhotoSide(p) === 'back') ?? null;

  // "saved*" mirrors what's actually persisted in the DB right now (only advances on a
  // successful handleSave); the plain state below is the draft the resident is editing —
  // uploads land here immediately (the file itself has to go to Storage right away to get
  // a path) but nothing is written to profiles until Save is clicked. Diffing draft vs.
  // saved is what lets a fresh upload show a "×" to undo it pre-save (see isStaged below).
  const [savedIdType, setSavedIdType] = useState(initialIdTypeRaw ?? '');
  const [savedFrontPath, setSavedFrontPath] = useState<string | null>(initialFrontPath);
  const [savedBackPath, setSavedBackPath] = useState<string | null>(initialBackPath);

  const [frontPath, setFrontPath] = useState<string | null>(initialFrontPath);
  const [backPath, setBackPath] = useState<string | null>(initialBackPath);
  const [frontSignedUrl, setFrontSignedUrl] = useState<string | null>(null);
  const [backSignedUrl, setBackSignedUrl] = useState<string | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enlargedUrl, setEnlargedUrl] = useState<string | null>(null);
  const router = useRouter();

  // Resolve each side's signed URL (id-documents is a private bucket) whenever its draft
  // path changes — covers the initial load and every upload/undo, so the photo is always
  // visible inline without the resident having to click anything first.
  useEffect(() => {
    let cancelled = false;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on react-hooks/set-state-in-effect.
    Promise.resolve().then(async () => {
      if (!frontPath) {
        if (!cancelled) setFrontSignedUrl(null);
        return;
      }
      const result = await getIdDocumentSignedUrl(frontPath);
      if (!cancelled) setFrontSignedUrl(result.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [frontPath]);

  useEffect(() => {
    let cancelled = false;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on react-hooks/set-state-in-effect.
    Promise.resolve().then(async () => {
      if (!backPath) {
        if (!cancelled) setBackSignedUrl(null);
        return;
      }
      const result = await getIdDocumentSignedUrl(backPath);
      if (!cancelled) setBackSignedUrl(result.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [backPath]);

  const [idTypeSheetOpen, setIdTypeSheetOpen] = useState(false);

  // A "valid" ID — for gating the Pending badge below — means an ID type and both photo
  // sides are actually persisted, not just staged in this session.
  const hasValidId = Boolean(savedIdType) && Boolean(savedFrontPath) && Boolean(savedBackPath);
  const showPending = verificationStatus === 'pending' && hasValidId;
  const showVerified = verificationStatus === 'verified';
  // Admin-set outcome (guard_id_verification_status, migration 0089) — the resident just
  // re-uploads to retry, same handleSave flow as a first-time submission.
  const showFailed = verificationStatus === 'verification_failed';

  const statusLabel = showVerified
    ? 'Verified ID'
    : showFailed
      ? 'Verification Failed, Try Again'
      : showPending
        ? 'Pending Verification'
        : 'Not Submitted';

  const statusColor = showVerified
    ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
    : showFailed
      ? 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30'
      : showPending
        ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
        : 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';

  async function handleUpload(side: 'front' | 'back', file: File) {
    if (!isWithinSizeLimit(file, MAX_ID_PHOTO_BYTES)) {
      toast.error('File too large (max 5 MB).');
      return;
    }
    if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    const setUploading = side === 'front' ? setUploadingFront : setUploadingBack;
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `${profileId}/id-${side}.${imageExtension(file.type)}`;
    // Fixed canonical path per side, upsert:true — re-uploading replaces this side's
    // photo in place instead of accumulating extra files (mirrors mobile's single-
    // canonical-path avatar/ID pattern). This only lands the file in Storage — it is
    // staged locally (draft state) and not written to profiles.id_photo_urls until the
    // resident clicks Save below, so it can still be undone via the "×" button.
    const { error: upErr } = await supabase.storage.from('id-documents').upload(path, file, { upsert: true });
    if (upErr) {
      toast.error(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    if (side === 'front') setFrontPath(path);
    else setBackPath(path);
    setUploading(false);
  }

  /** Undoes a staged (not-yet-saved) upload for one side, reverting the draft back to
   * whatever is actually persisted and best-effort deleting the orphaned Storage object.
   * Never called for an already-saved photo — the slot only shows "×" while staged. */
  async function handleRemoveStaged(side: 'front' | 'back') {
    const current = side === 'front' ? frontPath : backPath;
    const saved = side === 'front' ? savedFrontPath : savedBackPath;
    if (!current || current === saved) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.storage.from('id-documents').remove([current]);
    if (side === 'front') setFrontPath(saved);
    else setBackPath(saved);
  }

  const nextIdTypeValue = idType === 'Other' ? (otherType.trim() ? `${OTHER_ID_TYPE_PREFIX}${otherType.trim()}` : '') : idType;

  // Active only once an ID type is filled in AND both photo sides are uploaded, and only
  // while there's actually something new to persist (vs. what's already saved).
  const saveDisabled =
    saving ||
    uploadingFront ||
    uploadingBack ||
    !nextIdTypeValue ||
    !frontPath ||
    !backPath ||
    (nextIdTypeValue === savedIdType && frontPath === savedFrontPath && backPath === savedBackPath);

  async function handleSave() {
    if (saveDisabled || !frontPath || !backPath) return;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    // Reset to 'pending' on any change (guard_id_verification_status trigger allows this
    // but rejects 'verified' — see §7 write guards note above).
    const { error } = await supabase
      .from('profiles')
      .update({ id_type: nextIdTypeValue, id_photo_urls: [frontPath, backPath], id_verification_status: 'pending' })
      .eq('id', profileId);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    setSavedIdType(nextIdTypeValue);
    setSavedFrontPath(frontPath);
    setSavedBackPath(backPath);
    toast.success('ID verification details saved. Your status has been reset to Pending Verification.');
    router.refresh();
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

      {showFailed ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Your ID wasn&apos;t approved. Review the photos below and re-upload to try again.
        </p>
      ) : null}

      <div>
        <label className={labelCls}>
          ID Type
          <RequiredMark />
        </label>
        <IdTypeSheet
          open={idTypeSheetOpen}
          current={idType}
          onClose={() => setIdTypeSheetOpen(false)}
          onSelect={setIdType}
        />
        <button
          type="button"
          onClick={() => setIdTypeSheetOpen(true)}
          className={`${inputCls} flex items-center justify-between text-left`}>
          <span className={idType ? undefined : 'text-zinc-400'}>{idType || 'Select ID type…'}</span>
          <ChevronDown size={14} className="shrink-0 text-zinc-400" />
        </button>
        {idType === 'Other' ? (
          <>
            <input
              type="text"
              value={otherType}
              onChange={(e) => setOtherType(e.target.value)}
              placeholder="Specify your exact ID type"
              className={`${inputCls} mt-2`}
            />
            {!otherType.trim() ? <FieldStatus error="Please specify your exact ID type" /> : null}
          </>
        ) : null}
      </div>

      <div>
        <label className={labelCls}>
          ID Photos
          <RequiredMark />
        </label>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Upload one clear photo of the front and one of the back of your government-issued ID — you can re-upload
          either side any time. Stored privately — only you and barangay staff can view them.
        </p>
        <div className="flex gap-3">
          <IdPhotoSlot
            label="Front Side"
            path={frontPath}
            signedUrl={frontSignedUrl}
            uploading={uploadingFront}
            isStaged={frontPath !== savedFrontPath}
            onUpload={(f) => handleUpload('front', f)}
            onRemoveStaged={() => handleRemoveStaged('front')}
            onView={() => frontSignedUrl && setEnlargedUrl(frontSignedUrl)}
          />
          <IdPhotoSlot
            label="Back Side"
            path={backPath}
            signedUrl={backSignedUrl}
            uploading={uploadingBack}
            isStaged={backPath !== savedBackPath}
            onUpload={(f) => handleUpload('back', f)}
            onRemoveStaged={() => handleRemoveStaged('back')}
            onView={() => backSignedUrl && setEnlargedUrl(backSignedUrl)}
          />
        </div>
      </div>

      <Button type="button" onClick={handleSave} disabled={saveDisabled} size="sm" className="w-full">
        {saving ? 'Saving…' : 'Save ID Verification'}
      </Button>

      {/* Enlarged photo preview modal — a bonus on top of the always-visible inline
          thumbnails above, not required to see the photo in the first place. */}
      {enlargedUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEnlargedUrl(null)}>
          <div className="relative max-h-[80vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enlargedUrl} alt="ID document" className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-2xl" />
            <button onClick={() => setEnlargedUrl(null)} className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md dark:bg-zinc-800">
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
  const [birthDateIso, setBirthDateIso] = useState<string | null>(profile.birth_date ?? null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [mobileNumber, setMobileNumber] = useState(profile.mobile_number ?? '');
  const [email, setEmail] = useState(profile.email ?? '');
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
    email !== (profile.email ?? '') ||
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
  const emailStatus = fieldStatus(email, fieldErrors.email, validateEmail);
  const houseNoStatus = fieldStatus(houseNo, fieldErrors.houseNo);
  const streetStatus = fieldStatus(street, fieldErrors.street);
  const cityStatus = fieldStatus(city, fieldErrors.city);

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

    if (!email.trim()) errors.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address';

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
        email: email.trim() || null,
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
      <BirthdayCalendarModal
        open={showBirthPicker}
        value={birthDateIso ? isoToLocalDate(birthDateIso) : null}
        onClose={() => setShowBirthPicker(false)}
        onSave={(date) => {
          setBirthDateIso(dateToIso(date));
          setShowBirthPicker(false);
        }}
      />

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <span className="flex items-center rounded-l-lg border border-r-0 border-zinc-300 bg-zinc-50 px-2.5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
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
            <label className="text-sm">
              <span className={labelCls}>
                Email
                <RequiredMark />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                aria-invalid={!!emailStatus.error}
              />
              <FieldStatus {...emailStatus} />
            </label>
          </div>

          <div className="text-sm sm:w-1/3">
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

          <hr className="border-black/[0.06] dark:border-white/[0.06]" />
          <CardHeading icon={<MapPin size={15} />}>Home Address</CardHeading>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className={labelCls}>
                House No.
                <RequiredMark />
              </span>
              <input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} className={inputCls} aria-invalid={!!houseNoStatus.error} />
              <FieldStatus {...houseNoStatus} />
            </label>
            <label className="text-sm sm:col-span-2">
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
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} aria-invalid={!!cityStatus.error} />
              <FieldStatus {...cityStatus} />
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
