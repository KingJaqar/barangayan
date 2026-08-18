'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Tables } from '@barangayan/shared';

type ProfileFields = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email' | 'mobile_number' | 'home_address' | 'id_verification_status'>;

export function ProfileForm({ profile }: { profile: ProfileFields }) {
  const router = useRouter();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile.full_name);
  const [mobileNumber, setMobileNumber] = useState(profile.mobile_number ?? '');
  const [homeAddress, setHomeAddress] = useState(profile.home_address ?? '');
  const [saving, setSaving] = useState(false);

  const isDirty =
    fullName !== profile.full_name ||
    mobileNumber !== (profile.mobile_number ?? '') ||
    homeAddress !== (profile.home_address ?? '');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        mobile_number: mobileNumber.trim() || null,
        home_address: homeAddress.trim() || null,
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

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Full Name</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
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
        <input
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Home Address</span>
        <textarea
          value={homeAddress}
          onChange={(e) => setHomeAddress(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>

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
