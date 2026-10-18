'use client';

import { formatAdminTimestamp as formatDateTime } from '@/lib/admin-tables/pilot-config';
import { useEffect, useRef, useState } from 'react';

import { TableDetailDialog, TableDetailState } from '@/components/admin/table-detail-dialog';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { IncidentActions } from './incident-actions';
import { IncidentStatusPill } from './incident-table';
import type { IncidentRow } from './types';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

/** Full-detail modal — photos, description, location, reporter contact, and the same
 * status/remove actions available from the table row. The header form is the "Incident
 * Details" edit surface (title + description); Category, Reporter, Confirmation Status,
 * Current Status, and Submission Date are all edited inline in the table itself (click any
 * cell), so this modal focuses on the long-form fields plus a read-only summary of the rest.
 * Closes on Escape or backdrop click. */
export function IncidentDetailModal({ incident, onClose, onChanged, onEditingChange, detailStatus, onRetry }: {
  incident: IncidentRow; onClose: () => void; onChanged: () => void; onEditingChange: (editing: boolean) => void;
  detailStatus: 'loading' | 'ready' | 'error' | 'unavailable'; onRetry: () => void;
}) {

  const [activePhoto, setActivePhoto] = useState(0);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(incident.title);
  const [description, setDescription] = useState(incident.description ?? '');
  const [address, setAddress] = useState(incident.address ?? '');
  const [specificAreaDetails, setSpecificAreaDetails] = useState(incident.specific_area_details ?? '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    onEditingChange(editing);
    return () => onEditingChange(false);
  }, [editing, onEditingChange]);

  async function saveDetails() {
    const toastAttempt = beginAttempt('saveDetails');
    if (savingRef.current) return;
    if (!title.trim()) {
      toast.error('Title cannot be empty.', { id: toastAttempt });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    let result;
    try { result = await supabase
      .from('incidents')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        specific_area_details: specificAreaDetails.trim() || null,
      })
      .eq('id', incident.id).select('id').maybeSingle();
    } catch (cause) {
      savingRef.current = false; setSaving(false);
      toast.error(`Failed to save: ${cause instanceof Error ? cause.message : 'The update could not be completed.'}`, { id: toastAttempt }); return;
    }
    savingRef.current = false; setSaving(false);
    const { error, data: updated } = result;
    if (error || !updated) {
      toast.error(`Failed to save: ${error?.message ?? 'No record was updated. Check your access.'}`, { id: toastAttempt });
      return;
    }

    logAdminAction({
      action: 'update',
      entityType: 'incident',
      entityId: incident.id,
      entityLabel: title.trim(),
      changes: {
        before: {
          title: incident.title,
          description: incident.description,
          address: incident.address,
          specific_area_details: incident.specific_area_details,
        },
        after: {
          title: title.trim(),
          description: description.trim() || null,
          address: address.trim() || null,
          specific_area_details: specificAreaDetails.trim() || null,
        },
      },
    }).catch(() => {});

    toast.success('Incident details updated.', { id: toastAttempt });
    setEditing(false);
    onChanged();
  }

  const cat = incident.incident_categories;
  const photos = incident.photo_urls ?? [];
  const loc = incident.location as { lat?: number; lng?: number } | null;
  const hasLocation = typeof loc?.lat === 'number' && typeof loc?.lng === 'number';
  const mapsUrl = hasLocation ? `https://www.google.com/maps?q=${loc!.lat},${loc!.lng}` : null;

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <TableDetailDialog label={`Incident details: ${incident.title}`}
      preventClose={saving} onClose={() => { if (!savingRef.current) onClose(); }}>
      {detailStatus !== 'ready' && !editing ? <TableDetailState status={detailStatus} onClose={onClose} onRetry={onRetry} /> :
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">

        {/* Header */}
        <div className="flex max-h-[40vh] shrink-0 items-start justify-between gap-3 overflow-y-auto border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
            {!editing ? (
              <h2 className="text-lg font-bold leading-snug">{incident.title}</h2>
            ) : (
              <input
                autoFocus
                aria-label="Incident title"
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Incident title"
              />
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <IncidentStatusPill status={incident.status} />
              {cat && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>
                  {cat.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                👥 {incident.confirmation_count} confirmed
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto break-words [overflow-wrap:anywhere] px-6 py-4">
          {/* Photos */}
          {photos.length > 0 && (
            <div className="mb-4">
              {/* Plain <img> rather than next/image: these are resident-uploaded objects in
                  the public `incident-photos` bucket, whose host comes from
                  NEXT_PUBLIC_SUPABASE_URL and therefore differs per environment. Using
                  next/image would require env-dependent `remotePatterns` config and would
                  bill optimization for photos only a handful of admins ever open. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[activePhoto]}
                alt={`Incident photo ${activePhoto + 1}`}
                className="h-56 w-full rounded-xl object-cover"
              />
              {photos.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {photos.map((url, i) => (
                    <button
                      key={url}
                      onClick={() => setActivePhoto(i)}
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                        i === activePhoto ? 'border-[var(--accent)]' : 'border-transparent'
                      }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description / Incident Details edit form */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Incident Details</p>
              {!editing && (
                <button
                  onClick={() => {
                    setTitle(incident.title);
                    setDescription(incident.description ?? '');
                    setAddress(incident.address ?? '');
                    setSpecificAreaDetails(incident.specific_area_details ?? '');
                    setEditing(true);
                  }}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline">
                  Edit
                </button>
              )}
            </div>
            {!editing ? (
              incident.description ? (
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{incident.description}</p>
              ) : (
                <p className="text-sm text-zinc-400">No description provided.</p>
              )
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-label="Description" placeholder="Description"
                />
                <input
                  className={inputClass}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={300}
                  aria-label="Address" placeholder="Address"
                />
                <input
                  className={inputClass}
                  value={specificAreaDetails}
                  onChange={(e) => setSpecificAreaDetails(e.target.value)}
                  maxLength={300}
                  aria-label="Specific area details" placeholder="Specific area details (e.g. near the blue gate)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveDetails}
                    disabled={saving}
                    className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    aria-busy={saving}>
                    <LoadingButtonContent pending={saving} pendingLabel="Saving…">Save</LoadingButtonContent>
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="rounded-full bg-zinc-200 px-4 py-1.5 text-xs font-semibold dark:bg-zinc-700">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reporter */}
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Reported by</p>
            {incident.profiles ? (
              <div className="text-sm text-zinc-700 dark:text-zinc-300">
                <p className="font-medium">{incident.profiles.full_name}</p>
                {incident.profiles.email && (
                  <a href={`mailto:${incident.profiles.email}`} className="block text-[var(--accent)] hover:underline">
                    {incident.profiles.email}
                  </a>
                )}
                {incident.profiles.mobile_number && (
                  <a href={`tel:${incident.profiles.mobile_number}`} className="text-[var(--accent)] hover:underline">
                    {incident.profiles.mobile_number}
                  </a>
                )}
                {incident.profiles.home_address && (
                  <p className="text-xs text-zinc-500">{incident.profiles.home_address}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Anonymous report</p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              To reassign the reporter or category, use the Reporter/Category cells in the table.
            </p>
          </div>

          {/* Location */}
          {(hasLocation || incident.address || incident.specific_area_details) && !editing && (
            <div className="mb-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Location</p>
              {incident.address && <p className="text-sm text-zinc-700 dark:text-zinc-300">{incident.address}</p>}
              {hasLocation && (
                <p className="text-xs text-zinc-500">
                  {loc!.lat!.toFixed(5)}, {loc!.lng!.toFixed(5)}
                </p>
              )}
              {incident.specific_area_details && (
                <p className="mt-1 text-sm italic text-zinc-600 dark:text-zinc-400">
                  &ldquo;{incident.specific_area_details}&rdquo;
                </p>
              )}
              {hasLocation && (
                <a
                  href={mapsUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline">
                  Open in Google Maps ↗
                </a>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
            <div>
              <p className="font-semibold uppercase tracking-wide">Submitted</p>
              <p>{formatDateTime(incident.created_at)}</p>
            </div>
            {incident.updated_at !== incident.created_at && (
              <div>
                <p className="font-semibold uppercase tracking-wide">Last updated</p>
                <p>{formatDateTime(incident.updated_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <fieldset disabled={editing || saving} className="shrink-0 border-t border-black/10 px-6 py-4 dark:border-white/10">
          <IncidentActions incidentId={incident.id} status={incident.status} incidentTitle={incident.title} incidentDescription={incident.description} variant="full" onChanged={onChanged} />
        </fieldset>
      </div>}
    </TableDetailDialog>
  );
}
