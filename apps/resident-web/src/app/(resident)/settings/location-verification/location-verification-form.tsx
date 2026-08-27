'use client';

/**
 * Settings > Location Verification — a full map (centered on the resident's barangay,
 * boundary outlined) where the resident drags/taps a pin to their exact home location,
 * reviews/edits the auto-detected address, and saves. Ported from
 * apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx: same
 * reverse-geocode-on-move flow (reverseGeocode, @barangayan/shared), same hard
 * boundary-rejection UX (rejectedNotice banner), same "Detect Your Location" button as a
 * manual re-run of the same GPS fix the screen also tries automatically on first load,
 * and the same "Previously Saved Location" reference card. Uses the browser Geolocation
 * API in place of expo-location and Leaflet (location-verification-map.tsx) in place of
 * mobile's native MapView.
 *
 * Persists to profiles.verified_location (jsonb {lat,lng}, migration 0090) +
 * verified_location_address (text, migration 0091) + location_verified_at (0090).
 */
import type { Json, LatLng } from '@barangayan/shared';
import { reverseGeocode } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LocationVerificationMapWrapper } from './location-verification-map-wrapper';

export function LocationVerificationForm({
  profileId,
  barangayName,
  boundary,
  savedLocation,
  savedAddress,
}: {
  profileId: string;
  barangayName: string;
  boundary: Polygon | MultiPolygon;
  savedLocation: LatLng | null;
  savedAddress: string | null;
}) {
  const router = useRouter();

  const [position, setPosition] = useState<LatLng | null>(savedLocation);
  const [address, setAddress] = useState(savedAddress ?? '');
  const [addressLoading, setAddressLoading] = useState(false);
  // True once a geocode attempt has finished with no result — distinguishes "still
  // detecting" from "detection failed, please type it in" so an empty field after
  // loading doesn't just look broken.
  const [addressDetectFailed, setAddressDetectFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [rejectedNotice, setRejectedNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const geocodeRequestId = useRef(0);
  const autoLocateAttempted = useRef(false);

  async function fetchAddressFor(pos: LatLng) {
    const requestId = ++geocodeRequestId.current;
    setAddressLoading(true);
    setAddressDetectFailed(false);
    const result = await reverseGeocode(pos);
    // Ignore a stale response from a since-superseded pin placement.
    if (requestId !== geocodeRequestId.current) return;
    setAddressLoading(false);
    if (result) setAddress(result);
    else setAddressDetectFailed(true);
  }

  // If there's no previously-saved location, try a live GPS fix on first load —
  // auto-detecting its address — same as mobile's screen. A denied/unavailable fix
  // just leaves the pin unset (the map still shows the boundary to tap into).
  useEffect(() => {
    if (autoLocateAttempted.current || savedLocation) return;
    autoLocateAttempted.current = true;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => {
      if (!('geolocation' in navigator)) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(point);
          void fetchAddressFor(point);
          setLocating(false);
        },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }, [savedLocation]);

  /** "Detect Your Location" — a manual, explicit re-run of the same GPS fix the effect
   * above tries automatically on first load, for a resident who wants to re-center on
   * their current device location instead of dragging the pin by hand. Unlike the silent
   * first-load attempt, a failure here is a direct result of this click, so it's reported
   * with a toast rather than failing silently. */
  function handleDetectLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(point);
        setRejectedNotice(false);
        setSaved(false);
        void fetchAddressFor(point);
        setLocating(false);
      },
      () => {
        toast.error("Couldn't detect your location. Please try again or drag the pin manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handlePositionChange(pos: LatLng) {
    setPosition(pos);
    setRejectedNotice(false);
    setSaved(false);
    void fetchAddressFor(pos);
  }

  function handleRejected() {
    setRejectedNotice(true);
  }

  async function handleSave() {
    if (!position) return;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        // { lat, lng } structurally satisfies the jsonb column's Json type but has no
        // index signature of its own — cast, same as mobile's equivalent write.
        verified_location: { lat: position.lat, lng: position.lng } as unknown as Json,
        verified_location_address: address.trim() || null,
        location_verified_at: new Date().toISOString(),
      })
      .eq('id', profileId);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    setSaved(true);
    toast.success('Location saved.');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="relative h-[60vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-border">
        <LocationVerificationMapWrapper
          position={position}
          boundary={boundary}
          onPositionChange={handlePositionChange}
          onRejected={handleRejected}
        />
        <div className="pointer-events-none absolute left-1/2 top-3 z-[400] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3.5 py-1.5 text-xs font-medium text-white">
          <MapPin size={13} />
          {locating ? 'Locating you…' : 'Tap or drag the pin'}
        </div>
        {rejectedNotice ? (
          <div className="absolute bottom-3 left-3 right-3 z-[400] flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2.5 text-sm text-white shadow-lg">
            <AlertTriangle size={16} className="shrink-0" />
            Please pin a location inside {barangayName}&apos;s boundary.
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {/* Previously saved location — a static reference to what's actually on file
            right now, independent of the pin above. Only a successful Save updates it. */}
        {savedLocation ? (
          <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CheckCircle2 size={13} /> Previously Saved Location
            </span>
            <span className="text-sm">{savedAddress ?? 'No address on file'}</span>
            <span className="text-xs text-muted-foreground">
              {savedLocation.lat.toFixed(5)}, {savedLocation.lng.toFixed(5)}
            </span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="verified-address" className="text-xs font-semibold uppercase tracking-wide text-primary">
              Detected Address
            </label>
            {addressLoading ? <Loader2 size={13} className="animate-spin text-muted-foreground" /> : null}
          </div>
          <textarea
            id="verified-address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setSaved(false);
              setAddressDetectFailed(false);
            }}
            maxLength={300}
            rows={2}
            placeholder={addressLoading ? 'Detecting address…' : 'Type to correct the detected address'}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {addressDetectFailed && !address ? (
            <p className="text-xs text-destructive">Couldn&apos;t detect this address automatically — please type it in.</p>
          ) : null}
        </div>

        {position ? (
          <p className="text-xs text-muted-foreground">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={handleDetectLocation} loading={locating} className="flex-1">
            📍 Detect Your Location
          </Button>
          <Button type="button" onClick={handleSave} disabled={!position} loading={saving} className="flex-1">
            {saved ? 'Location Saved ✓' : 'Save My Location'}
          </Button>
        </div>
      </div>
    </div>
  );
}
