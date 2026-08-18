'use client';

import { EMPLOYMENT_STATUSES, EMPLOYMENT_STATUSES_WITH_OCCUPATION, SEXES, type EmploymentStatus, type Sex } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Tables } from '@barangayan/shared';

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
> & {
  barangays: Pick<Tables<'barangays'>, 'name'> | null;
};

const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female' };

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  unemployed: 'Unemployed',
  student: 'Student',
  self_employed: 'Self-Employed',
  retired: 'Retired',
};

const inputCls =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

export function ProfileForm({ profile }: { profile: ProfileFields }) {
  const router = useRouter();
  const toast = useToast();

  // Full Name split into structured parts (Register/Profile field-split) — full_name
  // is derived by the DB from these on save (migration 0081's
  // compose_profiles_display_fields trigger); this form never builds that string.
  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [lastName, setLastName] = useState(profile.last_name ?? '');
  const [middleName, setMiddleName] = useState(profile.middle_name ?? '');
  const [suffix, setSuffix] = useState(profile.suffix ?? '');
  const [sex, setSex] = useState<Sex | ''>((profile.sex as Sex | null) ?? '');
  const [mobileNumber, setMobileNumber] = useState(profile.mobile_number ?? '');
  // Home Address split into structured parts — home_address is likewise derived.
  // "Barangay" is deliberately read-only below (profiles.barangay_id), not a field here.
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
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
      toast.showError(`Failed to save: ${error.message}`);
      return;
    }
    toast.showSuccess('Profile updated.');
    router.refresh();
  }

  const idStatusLabel =
    profile.id_verification_status === 'verified'
      ? 'Verified'
      : profile.id_verification_status === 'pending'
        ? 'Pending Review'
        : 'Not Submitted';

  const showOccupation = employmentStatus !== '' && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus);

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">First Name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Last Name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Middle Name</span>
          <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Suffix</span>
          <input value={suffix} onChange={(e) => setSuffix(e.target.value)} className={inputCls} placeholder="e.g. Jr., III" />
        </label>
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Sex</span>
        <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')} className={inputCls}>
          <option value="">Select sex</option>
          {SEXES.map((s) => (
            <option key={s} value={s}>
              {SEX_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          value={profile.email ?? ''}
          disabled
          className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Mobile Number</span>
        <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className={inputCls} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">House No.</span>
          <input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} className={inputCls} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Street</span>
          <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
        </label>
      </div>
      <label className="text-sm">
        <span className="mb-1 block font-medium">City</span>
        <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
      </label>

      {/* Read-only — this is profiles.barangay_id, assigned automatically at
          registration (AGENTS.md §0), not a free-text address component. */}
      <div className="text-sm">
        <span className="mb-1 block font-medium">Barangay</span>
        <input
          value={profile.barangays?.name ?? '—'}
          disabled
          className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Employment Status</span>
        <select
          value={employmentStatus}
          onChange={(e) => {
            const next = e.target.value as EmploymentStatus | '';
            setEmploymentStatus(next);
            if (next === '' || !EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(next)) setOccupation('');
          }}
          className={inputCls}>
          <option value="">Select employment status</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {EMPLOYMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      {showOccupation ? (
        <label className="text-sm">
          <span className="mb-1 block font-medium">Occupation</span>
          <input value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputCls} placeholder="Optional" />
        </label>
      ) : null}

      <div className="text-sm">
        <span className="mb-1 block font-medium">ID Verification</span>
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {idStatusLabel}
        </span>
      </div>

      <button
        type="submit"
        disabled={saving || !isDirty}
        className="self-start rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  );
}
