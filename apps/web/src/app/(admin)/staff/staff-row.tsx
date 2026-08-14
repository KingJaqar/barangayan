'use client';

import {
  OFFICIAL_ROLES,
  OFFICIAL_ROLE_LABELS,
  staffSchema,
  type OfficialRole,
  type Tables,
} from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Official = Tables<'barangay_officials'> & { profile: Tables<'profiles'> };

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

export function StaffRow({
  official,
  currentUserId,
}: {
  official: Official;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = official.profile;

  const [fullName, setFullName] = useState(profile.full_name);
  const [officialRole, setOfficialRole] = useState<OfficialRole>(
    official.official_role as OfficialRole,
  );
  const [mobileNumber, setMobileNumber] = useState(profile.mobile_number ?? '');
  const [homeAddress, setHomeAddress] = useState(profile.home_address ?? '');

  const isCurrentUser = profile.id === currentUserId;

  function startEdit() {
    setFullName(profile.full_name);
    setOfficialRole(official.official_role as OfficialRole);
    setMobileNumber(profile.mobile_number ?? '');
    setHomeAddress(profile.home_address ?? '');
    setError(null);
    setIsEditing(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = staffSchema.safeParse({
      full_name: fullName,
      official_role: officialRole,
      mobile_number: mobileNumber || undefined,
      home_address: homeAddress || undefined,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const [{ error: profileErr }, { error: officialErr }] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          full_name: result.data.full_name,
          mobile_number: result.data.mobile_number || null,
          home_address: result.data.home_address || null,
        })
        .eq('id', profile.id),
      supabase
        .from('barangay_officials')
        .update({ official_role: result.data.official_role })
        .eq('id', official.id),
    ]);

    setSubmitting(false);

    const updateError = profileErr ?? officialErr;
    if (updateError) {
      setError(updateError.message);
      toast.showError(`Failed to save: ${updateError.message}`);
      return;
    }

    toast.showSuccess('Staff account updated.');
    setIsEditing(false);
    router.refresh();
  }

  async function remove() {
    const supabase = createSupabaseBrowserClient();
    const { error: removeError } = await supabase
      .from('barangay_officials')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', official.id);

    if (removeError) {
      toast.showError(`Failed to remove: ${removeError.message}`);
      return;
    }

    toast.showSuccess('Staff account removed.');
    router.refresh();
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-[#0F6E5B] bg-white p-4 dark:border-[#0F6E5B] dark:bg-zinc-900">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">Full Name</span>
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Barangay Role</span>
            <select
              className={inputClass}
              value={officialRole}
              onChange={(e) => setOfficialRole(e.target.value as OfficialRole)}>
              {OFFICIAL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {OFFICIAL_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Mobile Number</span>
            <input
              className={inputClass}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
            />
          </label>

          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">Home Address</span>
            <input
              className={inputClass}
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
            />
          </label>

          {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={submitting}
              className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  const roleColor = official.official_role === 'admin' ? '#0F6E5B' : '#2563EB';
  const roleLabel = OFFICIAL_ROLE_LABELS[official.official_role as OfficialRole] ?? official.official_role;

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${roleColor}1A`, color: roleColor }}>
              {roleLabel}
            </span>
            <span className="font-semibold">{profile.full_name}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{profile.email}</p>
          {profile.mobile_number ? (
            <p className="text-xs text-zinc-500">{profile.mobile_number}</p>
          ) : null}
          {profile.home_address ? (
            <p className="text-xs text-zinc-500">{profile.home_address}</p>
          ) : null}
          {official.date_hired ? (
            <p className="text-xs text-zinc-400">
              Hired {new Date(official.date_hired).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        {!isCurrentUser ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={startEdit}
              title="Edit"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-[#0F6E5B]/10 hover:text-[#0F6E5B] dark:hover:bg-[#0F6E5B]/20">
              ✏️
            </button>
            <ConfirmButton
              label="🗑"
              confirmLabel="Remove?"
              onConfirm={remove}
              title="Remove staff account"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300"
            />
          </div>
        ) : (
          <span className="text-xs text-zinc-400">current user</span>
        )}
      </div>
    </div>
  );
}
