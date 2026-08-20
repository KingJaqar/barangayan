'use client';

import type { MultiPolygon, Polygon } from 'geojson';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ChevronLeft, MapPin, ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { incidentReportSchema, reverseGeocode } from '@barangayan/shared';
import { LocationPickerMapWrapper } from '@/components/reports/location-picker-map-wrapper';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ACCEPTED_IMAGE_MIME_TYPES, isAcceptedImageType, isWithinSizeLimit, imageExtension } from '@/lib/image-upload';

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per photo

interface CategoryOption {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_trash_related: boolean;
}

interface ZoneOption {
  id: string;
  name: string;
}

interface NewReportFormProps {
  categories: CategoryOption[];
  zones: ZoneOption[];
  barangayId: string;
  boundary: Polygon | MultiPolygon;
}

/**
 * Migrated from admin-web's new-report-form.tsx and extended with:
 * - Up to 5 photo uploads to `incident-photos` bucket BEFORE the incidents INSERT (C-039
 *   — the plan explicitly notes this upload-before-insert order because there is no
 *   resident UPDATE policy for attaching photos after the row exists).
 * - shadcn/Tailwind styling to match resident-web's design system.
 *
 * The original form hardcoded `photo_urls: []` — this build wires the real upload.
 */
export function NewReportForm({ categories, zones, barangayId, boundary }: NewReportFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [specificAreaDetails, setSpecificAreaDetails] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sets the pinned point and auto-detects its address — shared by "Use My Location"
   * and the map picker (click/drag) so both stay wired to the same reverse-geocode flow. */
  function applyLocation(point: { lat: number; lng: number }) {
    setLocation(point);
    setError(null);
    setAddressLoading(true);
    reverseGeocode(point)
      .then((result) => { if (result) setAddress(result); })
      .finally(() => setAddressLoading(false));
  }

  function handleUseMyLocation() {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        applyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setError('Could not get your location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const valid: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!isAcceptedImageType(file)) {
        toast.error(`${file.name} is not an accepted image type (JPEG, PNG, WebP).`);
        continue;
      }
      if (!isWithinSizeLimit(file, MAX_BYTES)) {
        toast.error(`${file.name} exceeds the 10 MB per-photo limit.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    setPhotos((prev) => [...prev, ...valid]);
    setPhotoPreviewUrls((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
    // Reset the input so re-selecting the same file triggers onChange again.
    e.target.value = '';
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhotos(userId: string): Promise<string[]> {
    if (photos.length === 0) return [];
    setUploadingPhotos(true);
    const supabase = createSupabaseBrowserClient();
    const urls: string[] = [];

    for (const file of photos) {
      const ext = imageExtension(file.type);
      // Path: {userId}/{timestamp}-{random}.{ext} — scoped to the uploader, per §7's
      // storage-path requirement.
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error: uploadErr } = await supabase.storage
        .from('incident-photos')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadErr || !data) {
        toast.error(`Photo upload failed: ${uploadErr?.message ?? 'Unknown error'}`);
        setUploadingPhotos(false);
        return [];
      }

      const { data: { publicUrl } } = supabase.storage.from('incident-photos').getPublicUrl(data.path);
      urls.push(publicUrl);
    }

    setUploadingPhotos(false);
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = incidentReportSchema.safeParse({
      title,
      categoryId,
      description: description || undefined,
      photoUrls: [],
      location: location ?? { lat: 0, lng: 0 },
      address: address || undefined,
      specificAreaDetails: specificAreaDetails || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please fill in all required fields.');
      return;
    }
    if (!location) {
      setError('Location is required. Click "Use My Location" below.');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    // Upload photos BEFORE inserting the incident row — there is no resident UPDATE policy
    // for photo_urls after the row exists (plan §5, C-039, admin-web's note in new-report-form.tsx).
    const photoUrls = await uploadPhotos(user.id);
    if (photos.length > 0 && photoUrls.length === 0) {
      // uploadPhotos already toasted the error.
      setSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase.from('incidents').insert({
      barangay_id: barangayId,
      reporter_id: user.id,
      category_id: parsed.data.categoryId,
      zone_id: zoneId || null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      photo_urls: photoUrls,
      location: parsed.data.location,
      address: parsed.data.address ?? null,
      specific_area_details: parsed.data.specificAreaDetails ?? null,
      status: 'open',
    });

    setSubmitting(false);

    if (insertErr) {
      toast.error(`Failed to submit report: ${insertErr.message}`);
      return;
    }

    toast.success('Report submitted successfully.');
    router.replace('/reports');
    router.refresh();
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isTrashRelated = selectedCategory?.is_trash_related ?? false;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Back + title */}
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft size={16} />
          Back
        </button>
        <h1 className="text-xl font-bold tracking-tight">Report an Incident</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe the problem so the barangay can address it quickly.
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="incident-title">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="incident-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. Broken streetlight on Rizal St."
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
        />
      </div>

      {/* Category */}
      <div>
        <span className="mb-2 block text-sm font-medium">
          Category <span className="text-red-500">*</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={
                categoryId === cat.id
                  ? { backgroundColor: cat.color ?? 'var(--accent)', color: '#fff', borderColor: cat.color ?? 'var(--accent)' }
                  : { borderColor: '#D4D4D8', color: cat.color ?? 'inherit' }
              }>
              {cat.name}
            </button>
          ))}
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories configured.</p>}
        </div>
      </div>

      {/* Waste zone — only for trash-related categories */}
      {isTrashRelated && zones.length > 0 && (
        <div>
          <span className="mb-1 block text-sm font-medium">Collection Zone</span>
          <p className="mb-2 text-xs text-muted-foreground">Which zone is this in? Helps the barangay track dumping hotspots.</p>
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() => setZoneId(zoneId === zone.id ? '' : zone.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  zoneId === zone.id
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}>
                {zone.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="incident-description">
          Description
        </label>
        <textarea
          id="incident-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
        />
      </div>

      {/* Photos */}
      <div>
        <span className="mb-2 block text-sm font-medium">
          Photos <span className="text-xs text-muted-foreground">(up to {MAX_PHOTOS})</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {photoPreviewUrls.map((url, i) => (
            <div key={url} className="relative size-16 rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label="Remove photo"
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                <X size={11} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
              <ImagePlus size={20} />
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_MIME_TYPES.join(',')}
          multiple
          onChange={handlePhotoPick}
          className="sr-only"
          aria-label="Add photos"
        />
      </div>

      {/* Location */}
      <div>
        <span className="mb-1.5 block text-sm font-medium">
          Location <span className="text-red-500">*</span>
        </span>
        <p className="mb-2 text-xs text-muted-foreground">Tap or drag the pin on the map to mark the exact spot.</p>

        <LocationPickerMapWrapper position={location} boundary={boundary} onPositionChange={applyLocation} />

        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="mt-2 flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--accent)] disabled:opacity-50">
          <MapPin size={15} />
          {locating ? 'Locating…' : location ? 'Location captured ✓' : 'Use My Location'}
        </button>
        {location && (
          <p className="mt-1 text-xs text-muted-foreground">
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </p>
        )}
        {location && (
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={300}
            placeholder={addressLoading ? 'Detecting address…' : 'Address (auto-detected — type to correct)'}
          />
        )}
      </div>

      {/* Specific area details */}
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="incident-area">
          Specific Area Details
        </label>
        <input
          id="incident-area"
          value={specificAreaDetails}
          onChange={(e) => setSpecificAreaDetails(e.target.value)}
          maxLength={300}
          placeholder="e.g. near the blue gate, 2nd house from the corner"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || uploadingPhotos || !title || !categoryId || !location}
        className="flex items-center justify-center gap-2 self-start rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
        {(submitting || uploadingPhotos) && <Loader2 size={14} className="animate-spin" />}
        {uploadingPhotos ? 'Uploading photos…' : submitting ? 'Submitting…' : 'Submit Report'}
      </button>
    </form>
  );
}
