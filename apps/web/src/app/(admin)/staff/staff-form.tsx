'use client';

import { OFFICIAL_ROLES, OFFICIAL_ROLE_LABELS, staffInviteSchema } from '@barangayan/shared';
import type { OfficialRole } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

export function StaffForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [officialRole, setOfficialRole] = useState<OfficialRole>('staff');
  const [mobileNumber, setMobileNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = staffInviteSchema.safeParse({
      email,
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

    try {
      const response = await fetch('/api/admin/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to invite staff.');
      }

      setEmail('');
      setFullName('');
      setOfficialRole('staff');
      setMobileNumber('');
      setHomeAddress('');
      toast.showSuccess('Staff account invited successfully.');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite staff.';
      setError(message);
      toast.showError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="staff@barangay.gov.ph"
          required
        />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Full Name</span>
        <input
          className={inputClass}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Juan Dela Cruz"
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
          placeholder="+63 900 000 0000"
        />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Home Address</span>
        <input
          className={inputClass}
          value={homeAddress}
          onChange={(e) => setHomeAddress(e.target.value)}
          placeholder="123 Main St, Brgy. Sample"
        />
      </label>

      {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Inviting…' : 'Invite Account'}
        </button>
      </div>
    </form>
  );
}
