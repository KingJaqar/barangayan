'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MapPin } from 'lucide-react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { incidentReportSchema, type Tables } from '@barangayan/shared';

type CategoryOption = Pick<Tables<'incident_categories'>, 'id' | 'name' | 'color' | 'is_trash_related'>;
type ZoneOption = Pick<Tables<'waste_zones'>, 'id' | 'name'>;

export function NewReportForm({ categories, zones }: { categories: CategoryOption[]; zones: ZoneOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUseMyLocation() {
    if (!('geolocation' in navigator)) {
      setError('Your browser does not support geolocation. Enter coordinates manually is not yet supported here — please use the mobile app instead.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Please allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

    const { error: insertErr } = await supabase.from('incidents').insert({
      barangay_id: profile!.barangay_id,
      reporter_id: user!.id,
      category_id: parsed.data.categoryId,
      zone_id: zoneId || null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      photo_urls: [],
      location: parsed.data.location,
      status: 'open',
    });

    setSubmitting(false);

    if (insertErr) {
      toast.showError(`Failed to submit report: ${insertErr.message}`);
      return;
    }

    toast.showSuccess('Report submitted.');
    router.replace('/resident/reports');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Title *</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. Broken streetlight on Rizal St."
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>

      <div>
        <span className="mb-2 block text-sm font-medium">Category *</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={
                categoryId === cat.id
                  ? { backgroundColor: cat.color, color: '#fff', borderColor: cat.color }
                  : { borderColor: '#D4D4D8', color: cat.color }
              }>
              {cat.name}
            </button>
          ))}
          {categories.length === 0 && <p className="text-sm text-zinc-500">No categories configured.</p>}
        </div>
      </div>

      {categories.find((c) => c.id === categoryId)?.is_trash_related && zones.length > 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium">Collection Zone</span>
          <p className="mb-2 text-xs text-zinc-500">Which zone is this in? Helps the barangay track dumping hotspots.</p>
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => (
              <button
                type="button"
                key={zone.id}
                onClick={() => setZoneId(zoneId === zone.id ? '' : zone.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  zoneId === zone.id
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
                }`}>
                {zone.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>

      <div>
        <span className="mb-1 block text-sm font-medium">Location *</span>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700">
          <MapPin size={16} />
          {locating ? 'Locating…' : location ? 'Location captured ✓' : 'Use My Location'}
        </button>
        {location && (
          <p className="mt-1 text-xs text-zinc-400">
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !title || !categoryId || !location}
        className="self-start rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {submitting ? 'Submitting…' : 'Submit Report'}
      </button>
    </form>
  );
}
