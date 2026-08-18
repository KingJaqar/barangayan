'use client';

import { evacuationCenterSchema, EVACUATION_CENTER_FACILITIES, type EvacuationCenterFacility, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type EvacuationCenter = Tables<'evacuation_centers'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';

function formatPosition(position: unknown): string {
  if (
    typeof position === 'object' &&
    position !== null &&
    'lat' in position &&
    'lng' in position
  ) {
    return `${Number((position as { lat: unknown }).lat).toFixed(6)}, ${Number((position as { lng: unknown }).lng).toFixed(6)}`;
  }
  return '—';
}

export function EvacuationCenterRow({ center }: { center: EvacuationCenter }) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(center.name);
  const [address, setAddress] = useState(center.address ?? '');
  const [lat, setLat] = useState(() => {
    if (typeof center.position === 'object' && center.position !== null && 'lat' in center.position) {
      return String(center.position.lat);
    }
    return '';
  });
  const [lng, setLng] = useState(() => {
    if (typeof center.position === 'object' && center.position !== null && 'lng' in center.position) {
      return String(center.position.lng);
    }
    return '';
  });
  const [capacity, setCapacity] = useState(center.capacity?.toString() ?? '');
  const [currentOccupancy, setCurrentOccupancy] = useState(center.current_occupancy.toString());
  const [isActive, setIsActive] = useState(center.is_active);
  const [contactNumber, setContactNumber] = useState(center.contact_number ?? '');
  const [facilitiesState, setFacilitiesState] = useState<EvacuationCenterFacility[]>(
    (center.facilities as EvacuationCenterFacility[]) ?? [],
  );
  const [verified, setVerified] = useState(center.verified);

  const [channelName] = useState(() => `admin-evacuation-centers-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evacuation_centers', filter: `barangay_id=eq.${center.barangay_id}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, channelName, center.barangay_id]);

  function startEdit() {
    setName(center.name);
    setAddress(center.address ?? '');
    if (typeof center.position === 'object' && center.position !== null && 'lat' in center.position) {
      setLat(String(center.position.lat));
    } else {
      setLat('');
    }
    if (typeof center.position === 'object' && center.position !== null && 'lng' in center.position) {
      setLng(String(center.position.lng));
    } else {
      setLng('');
    }
    setCapacity(center.capacity?.toString() ?? '');
    setCurrentOccupancy(center.current_occupancy.toString());
    setIsActive(center.is_active);
    setContactNumber(center.contact_number ?? '');
    setFacilitiesState((center.facilities as EvacuationCenterFacility[]) ?? []);
    setVerified(center.verified);
    setError(null);
    setIsEditing(true);
  }

  function toggleFacility(facility: EvacuationCenterFacility) {
    setFacilitiesState((prev) =>
      prev.includes(facility) ? prev.filter((f) => f !== facility) : [...prev, facility],
    );
  }

  async function handleSave(event: React.FormEvent) {
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
      facilities: facilitiesState,
      verified,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from('evacuation_centers')
      .update({
        name: result.data.name,
        address: result.data.address || null,
        position: { lat: result.data.lat, lng: result.data.lng },
        capacity: result.data.capacity,
        current_occupancy: result.data.current_occupancy,
        is_active: result.data.is_active,
        contact_number: result.data.contact_number || null,
        facilities: result.data.facilities,
        verified: result.data.verified,
      })
      .eq('id', center.id);
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      toast.showError(`Failed to save: ${updateError.message}`);
      return;
    }

    toast.showSuccess('Center updated.');
    setIsEditing(false);
    router.refresh();
  }

  async function archive() {
    const supabase = createSupabaseBrowserClient();
    const { error: archiveError } = await supabase
      .from('evacuation_centers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', center.id);
    if (archiveError) {
      toast.showError(`Failed to archive: ${archiveError.message}`);
      return;
    }
    toast.showSuccess('Center archived.');
    router.refresh();
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-[var(--accent)] bg-white p-3 dark:border-[var(--accent)] dark:bg-zinc-900">
        <div className="grid grid-cols-4 gap-3">
          <label className="col-span-4 text-sm sm:col-span-2">
            <span className={labelClass}>Name</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label className="col-span-4 text-sm sm:col-span-2">
            <span className={labelClass}>Address</span>
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Latitude</span>
            <input
              className={inputClass}
              type="number"
              step="0.000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Longitude</span>
            <input
              className={inputClass}
              type="number"
              step="0.000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Capacity</span>
            <input
              className={inputClass}
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min="0"
            />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Current Occupancy</span>
            <input
              className={inputClass}
              type="number"
              value={currentOccupancy}
              onChange={(e) => setCurrentOccupancy(e.target.value)}
              min="0"
            />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Contact Number</span>
            <input className={inputClass} value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
          </label>

          <label className="text-sm">
            <span className={labelClass}>Status</span>
            <select
              className={inputClass}
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="font-medium">Verified</span>
          </label>

          <fieldset className="col-span-4">
            <legend className={labelClass}>Facilities</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {EVACUATION_CENTER_FACILITIES.map((facility) => (
                <label key={facility} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={facilitiesState.includes(facility)}
                    onChange={() => toggleFacility(facility)}
                    className="rounded border-zinc-300"
                  />
                  {facility.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </fieldset>

          {error ? <p className="col-span-4 text-sm text-red-600">{error}</p> : null}

          <div className="col-span-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={submitting}
              className="rounded-full bg-zinc-200 px-5 py-1.5 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{center.name}</span>
            {center.verified ? (
              <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                ✓ Verified
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800">
                Unverified
              </span>
            )}
            {!center.is_active && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                Inactive
              </span>
            )}
            {center.deleted_at && (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                Archived
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {center.address ?? 'No address'} · 📍 {formatPosition(center.position)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-300">
            <span>Capacity: {center.capacity ?? '—'}</span>
            <span>Occupancy: {center.current_occupancy}</span>
            {center.contact_number && <span>📞 {center.contact_number}</span>}
          </div>
          {(center.facilities?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {center.facilities!.map((facility) => (
                <span
                  key={facility}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {facility.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={startEdit}
            title="Edit"
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:hover:bg-[var(--accent)]/20">
            ✏️
          </button>
          <ConfirmButton
            label="🗑"
            confirmLabel="Archive?"
            onConfirm={archive}
            title="Archive"
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          />
        </div>
      </div>
    </div>
  );
}
