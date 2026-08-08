'use client';

import { formatDateTime } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { IncidentActions } from './incident-actions';
import { IncidentStatusPill } from './incident-table';
import type { IncidentRow } from './page';

/** Full-detail modal — photos, description, location, reporter contact, and the same
 * status/remove actions available from the table row. The header form is the "Incident
 * Details" edit surface (title + description); Category, Reporter, Confirmation Status,
 * Current Status, and Submission Date are all edited inline in the table itself (click any
 * cell), so this modal focuses on the long-form fields plus a read-only summary of the rest.
 * Closes on Escape or backdrop click. */
export function IncidentDetailModal({ incident, onClose }: { incident: IncidentRow; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [activePhoto, setActivePhoto] = useState(0);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(incident.title);
  const [description, setDescription] = useState(incident.description ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function saveDetails() {
    if (!title.trim()) {
      toast.showError('Title cannot be empty.');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('incidents')
      .update({ title: title.trim(), description: description.trim() || null })
      .eq('id', incident.id);
    setSaving(false);
    if (error) {
      toast.showError(`Failed to save: ${error.message}`);
      return;
    }
    toast.showSuccess('Incident details updated.');
    setEditing(false);
    router.refresh();
  }

  const cat = incident.incident_categories;
  const photos = incident.photo_urls ?? [];
  const loc = incident.location as { lat?: number; lng?: number } | null;
  const hasLocation = typeof loc?.lat === 'number' && typeof loc?.lng === 'number';
  const mapsUrl = hasLocation ? `https://www.google.com/maps?q=${loc!.lat},${loc!.lng}` : null;

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Incident details: ${incident.title}`}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="flex-1">
            {!editing ? (
              <h2 className="text-lg font-bold leading-snug">{incident.title}</h2>
            ) : (
              <input
                autoFocus
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
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0F6E5B]/15 px-2 py-0.5 text-xs font-semibold text-[#0F6E5B]">
                👥 {incident.confirmation_count} confirmed
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
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
                        i === activePhoto ? 'border-[#0F6E5B]' : 'border-transparent'
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
                    setEditing(true);
                  }}
                  className="text-xs font-semibold text-[#0F6E5B] hover:underline">
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
                  placeholder="Description"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveDetails}
                    disabled={saving}
                    className="rounded-full bg-[#0F6E5B] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
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
                {incident.profiles.mobile_number && (
                  <a href={`tel:${incident.profiles.mobile_number}`} className="text-[#0F6E5B] hover:underline">
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
          {hasLocation && (
            <div className="mb-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Location</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {loc!.lat!.toFixed(5)}, {loc!.lng!.toFixed(5)}
              </p>
              <a
                href={mapsUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#0F6E5B] hover:underline">
                Open in Google Maps ↗
              </a>
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
        <div className="border-t border-black/10 px-6 py-4 dark:border-white/10">
          <IncidentActions incidentId={incident.id} status={incident.status} variant="full" />
        </div>
      </div>
    </div>
  );
}
