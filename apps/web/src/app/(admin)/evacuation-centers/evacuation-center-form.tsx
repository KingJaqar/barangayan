'use client';

import { evacuationCenterSchema, EVACUATION_CENTER_FACILITIES, type EvacuationCenterFacility } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

export function EvacuationCenterForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [capacity, setCapacity] = useState('');
  const [currentOccupancy, setCurrentOccupancy] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [contactNumber, setContactNumber] = useState('');
  const [facilities, setFacilities] = useState<EvacuationCenterFacility[]>([]);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleFacility(facility: EvacuationCenterFacility) {
    setFacilities((prev) =>
      prev.includes(facility) ? prev.filter((f) => f !== facility) : [...prev, facility],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedLat = lat === '' ? NaN : parseFloat(lat);
    const parsedLng = lng === '' ? NaN : parseFloat(lng);

    const result = evacuationCenterSchema.safeParse({
      name,
      address: address || undefined,
      lat: parsedLat,
      lng: parsedLng,
      capacity: capacity === '' ? null : parseInt(capacity, 10),
      current_occupancy: currentOccupancy === '' ? 0 : parseInt(currentOccupancy, 10),
      is_active: isActive,
      contact_number: contactNumber || undefined,
      facilities,
      verified,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from('evacuation_centers').insert({
      barangay_id: barangayId,
      name: result.data.name,
      address: result.data.address || null,
      position: { lat: result.data.lat, lng: result.data.lng },
      capacity: result.data.capacity,
      current_occupancy: result.data.current_occupancy,
      is_active: result.data.is_active,
      contact_number: result.data.contact_number || null,
      facilities: result.data.facilities,
      verified: result.data.verified,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      toast.showError(`Failed to create center: ${insertError.message}`);
      return;
    }

    setName('');
    setAddress('');
    setLat('');
    setLng('');
    setCapacity('');
    setCurrentOccupancy('');
    setIsActive(true);
    setContactNumber('');
    setFacilities([]);
    setVerified(false);
    toast.showSuccess(`Evacuation center created.`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Name *</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ampid 1 Elementary"
          required
        />
      </label>

      <label className="col-span-2 text-sm">
        <span className="mb-1 block font-medium">Address</span>
        <input
          className={inputClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street / landmark"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Latitude *</span>
        <input
          className={inputClass}
          type="number"
          step="0.000001"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="14.684583"
          required
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Longitude *</span>
        <input
          className={inputClass}
          type="number"
          step="0.000001"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="121.112071"
          required
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Capacity</span>
        <input
          className={inputClass}
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="e.g. 500"
          min="0"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Current Occupancy</span>
        <input
          className={inputClass}
          type="number"
          value={currentOccupancy}
          onChange={(e) => setCurrentOccupancy(e.target.value)}
          placeholder="Defaults to 0"
          min="0"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Contact Number</span>
        <input
          className={inputClass}
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          placeholder="(02) 8123-4501"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Status</span>
        <select
          className={inputClass}
          value={isActive ? 'active' : 'inactive'}
          onChange={(e) => setIsActive(e.target.value === 'active')}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>

      <fieldset className="col-span-2">
        <legend className="mb-1 block text-sm font-medium">Facilities</legend>
        <div className="flex flex-wrap gap-3">
          {EVACUATION_CENTER_FACILITIES.map((facility) => (
            <label key={facility} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={facilities.includes(facility)}
                onChange={() => toggleFacility(facility)}
                className="rounded border-zinc-300"
              />
              {facility.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
          className="rounded border-zinc-300"
        />
        <span className="font-medium">Verified</span>
      </label>

      {error ? <p className="col-span-2 text-sm text-red-600">{error}</p> : null}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[#0F6E5B] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create Center'}
        </button>
      </div>
    </form>
  );
}
