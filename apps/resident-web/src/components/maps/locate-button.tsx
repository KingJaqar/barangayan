'use client';

import { LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { useMap } from 'react-leaflet';
import { toast } from 'sonner';

/** "You" button — requests (or re-requests) geolocation permission, drops/updates the
 * blue "you are here" marker via `onLocated`, and recenters the map on the result.
 * Self-contained: unlike the automatic on-mount geolocation elsewhere in this app, this
 * is an explicit, user-initiated request, so it's the right place to retry after an
 * earlier denial too. */
export function LocateButton({ onLocated }: { onLocated: (position: { lat: number; lng: number }) => void }) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  function handleClick() {
    if (!('geolocation' in navigator)) {
      toast.error("This browser doesn't support location access.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocated(next);
        map.flyTo([next.lat, next.lng], 17);
        setIsLocating(false);
      },
      () => {
        toast.error('Location access denied — enable it in your browser settings to use this.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLocating}
      title="Show my location"
      aria-label="Show my current location"
      className="absolute bottom-20 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 disabled:opacity-60">
      <LocateFixed className={`h-4 w-4 text-foreground/80 ${isLocating ? 'animate-pulse' : ''}`} strokeWidth={2} />
    </button>
  );
}
