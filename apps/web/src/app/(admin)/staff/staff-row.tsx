'use client';

import { staffSchema, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Staff = Tables<'profiles'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

export function StaffRow({ staff, currentUserId }: { staff: Staff; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(staff.full_name);
  const [role, setRole] = useState<'admin' | 'staff'>(staff.role as 'admin' | 'staff');
  const [mobileNumber, setMobileNumber] = useState(staff.mobile_number ?? '');
  const [homeAddress, setHomeAddress] = useState(staff.home_address ?? '');

  const isCurrentUser = staff.id === currentUserId;

  function startEdit() {
    setFullName(staff.full_name);
    setRole(staff.role as 'admin' | 'staff');
    setMobileNumber(staff.mobile_number ?? '');
    setHomeAddress(staff.home_address ?? '');
    setError(null);
    setIsEditing(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = staffSchema.safeParse({
      full_name: fullName,
      role,
      mobile_number: mobileNumber || undefined,
      home_address: homeAddress || undefined,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: result.data.full_name,
        role: result.data.role,
        mobile_number: result.data.mobile_number || null,
        home_address: result.data.home_address || null,
      })
      .eq('id', staff.id);

    setSubmitting(false);

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
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', staff.id);

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
            <span className="mb-1 block font-medium">Role</span>
            <select
              className={inputClass}
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
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

  const roleColor = staff.role === 'admin' ? '#0F6E5B' : '#2563EB';
  const roleLabel = staff.role === 'admin' ? 'Admin' : 'Staff';

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
            <span className="font-semibold">{staff.full_name}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{staff.email}</p>
          {staff.mobile_number ? (
            <p className="text-xs text-zinc-500">{staff.mobile_number}</p>
          ) : null}
          {staff.home_address ? (
            <p className="text-xs text-zinc-500">{staff.home_address}</p>
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
