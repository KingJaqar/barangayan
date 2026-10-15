'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { OFFICIAL_ROLES, OFFICIAL_ROLE_LABELS, staffInviteSchema } from '@barangayan/shared';
import type { OfficialRole } from '@barangayan/shared';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { formContainerClass, inputClass, submitButtonClass, cancelButtonClass } from '@/components/admin/form-styles';

export function StaffForm({ barangayId, onClose, onChanged }: { barangayId: string; onClose: () => void; onChanged: () => void }) {
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
      onClose();
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite staff.';
      setError(message);
      toast.showError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${formContainerClass} mb-6 grid-cols-1 sm:grid-cols-2`}
    >
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
        <AdminSelect kind="people" className={inputClass} value={officialRole} onValueChange={(nextValue) => setOfficialRole(nextValue as OfficialRole)}>
          {OFFICIAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {OFFICIAL_ROLE_LABELS[r]}
            </option>
          ))}
        </AdminSelect>
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

      <div className="col-span-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className={submitButtonClass}
          aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Inviting…">Invite Account</LoadingButtonContent>
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className={cancelButtonClass}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
