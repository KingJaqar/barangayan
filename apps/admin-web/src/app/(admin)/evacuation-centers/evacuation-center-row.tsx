'use client';

import { ContentEditDialog } from '@/components/admin/content-edit-dialog';
import editStyles from '@/components/admin/content-edit-dialog.module.css';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { ContentStatus } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';

import { Archive, Check, MapPin, Pencil, Phone } from 'lucide-react';

import { evacuationCenterSchema, EVACUATION_CENTER_FACILITIES, type EvacuationCenterFacility, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

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
    const toastAttempt = beginAttempt('handleSave');
    try {
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
        toast.error('Review the highlighted fields before continuing.', { id: toastAttempt });
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
        toast.error(`Failed to save: ${updateError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'update',
        entityType: 'evacuation_center',
        entityId: center.id,
        entityLabel: result.data.name,
        changes: {
          before: {
            name: center.name,
            address: center.address,
            position: center.position,
            capacity: center.capacity,
            current_occupancy: center.current_occupancy,
            is_active: center.is_active,
            contact_number: center.contact_number,
            facilities: center.facilities,
            verified: center.verified,
          },
          after: {
            name: result.data.name,
            address: result.data.address || null,
            position: { lat: result.data.lat, lng: result.data.lng },
            capacity: result.data.capacity,
            current_occupancy: result.data.current_occupancy,
            is_active: result.data.is_active,
            contact_number: result.data.contact_number || null,
            facilities: result.data.facilities,
            verified: result.data.verified,
          },
        },
      }).catch(() => {});

      toast.success('Center updated.', { id: toastAttempt });
      setIsEditing(false);
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    } finally { setSubmitting(false); }
  }

  async function archive() {
    const toastAttempt = beginAttempt('archive');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: archiveError } = await supabase
        .from('evacuation_centers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', center.id);
      if (archiveError) {
        toast.error(`Failed to archive: ${archiveError.message}`, { id: toastAttempt });
        return;
      }

      logAdminAction({
        action: 'delete',
        entityType: 'evacuation_center',
        entityId: center.id,
        entityLabel: center.name,
        metadata: { name: center.name, address: center.address, capacity: center.capacity },
      }).catch(() => {});

      toast.success('Center archived.', { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  return (
    <>
    <ContentEditDialog open={isEditing} title="Edit evacuation center" context={center.name}
      description="Update location, occupancy, contact details, and available facilities." busy={submitting} onClose={() => setIsEditing(false)}>
      <form
        onSubmit={handleSave}
        className={editStyles.form} aria-busy={submitting}>
        <div className={editStyles.fields} data-edit-scroll>
        <fieldset disabled={submitting}>
          <div className={editStyles.grid}>
            <label className="text-sm">
              <span className={labelClass}>Name</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>

            <label className="text-sm">
              <span className={labelClass}>Address</span>
              <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>

            <h3 className={editStyles.groupTitle}>Location coordinates</h3>
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

            <h3 className={editStyles.groupTitle}>Capacity & contact</h3>
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
              <AdminSelect kind="status"
                className={inputClass}
                value={isActive ? 'active' : 'inactive'}
                onValueChange={(nextValue) => setIsActive(nextValue === 'active')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </AdminSelect>
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

            <fieldset className={editStyles.full}>
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

          {error ? <p role="alert" className={`${editStyles.full} ${editStyles.error}`}>{error}</p> : null}

        </div>
        </fieldset>
        </div>
        <div className={editStyles.actions}>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}>
            <LoadingButtonContent pending={submitting} pendingLabel="Saving…">Save Changes</LoadingButtonContent>
          </button>
        </div>
      </form>
    </ContentEditDialog>
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <div className={styles.rowMain}>
          <h3 className={styles.rowTitle}>{center.name}</h3>
          <div className={styles.rowMeta}>
            <ContentStatus active={center.is_active} />
            <span className={`${styles.badge} ${center.verified ? styles.activeStatus : styles.warningStatus}`}>
              {center.verified ? <Check size={14} aria-hidden="true" /> : null}
              {center.verified ? 'Verified' : 'Unverified'}
            </span>
            {center.deleted_at ? <span className={styles.badge}>Archived</span> : null}
          </div>
          <p className={styles.rowDescription}>
            <MapPin size={15} className="mr-1 inline-block" aria-hidden="true" />{center.address ?? 'No address provided'}
          </p>
          <div className={styles.keyDetails}>
            <span>Capacity <strong>{center.capacity?.toLocaleString() ?? 'Not specified'}</strong></span>
            <span>Occupancy <strong>{center.current_occupancy.toLocaleString()}</strong></span>
            {center.capacity !== null && center.current_occupancy >= center.capacity && center.capacity > 0
              ? <span className={styles.warningStatus}>At capacity</span> : null}
            {center.contact_number ? <span><Phone size={15} aria-hidden="true" />{center.contact_number}</span> : null}
          </div>
          {(center.facilities?.length ?? 0) > 0 ? <div className={styles.rowMeta}>
            {center.facilities!.map(facility => <span key={facility} className={styles.badge}>
              {facility.replace(/_/g, ' ')}
            </span>)}
          </div> : null}
          <details className={styles.details}>
            <summary>Location coordinates</summary>
            <p className="mt-2">{formatPosition(center.position)}</p>
          </details>
        </div>
        <div className={styles.rowActions}>
          <button type="button" onClick={startEdit} aria-haspopup="dialog" aria-label={`Edit ${center.name}`} className={styles.primaryAction}>
            <Pencil size={15} aria-hidden="true" />Edit
          </button>
          <ConfirmButton label={<><Archive size={15} aria-hidden="true" />Archive</>}
            ariaLabel={`Archive ${center.name}`} confirmLabel="Archive?" onConfirm={archive}
            title="Archive center" className={styles.dangerAction} />
        </div>
      </div>
    </article>
    </>
  );
}
