'use client';

import { LocateFixed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

import { beginAttempt, notify } from '@/lib/notify';

/** "You" button — requests (or re-requests) geolocation permission, drops/updates the
 * blue "you are here" marker via `onLocated`, and recenters the map on the result.
 * Self-contained: unlike the automatic on-mount geolocation elsewhere in this app, this
 * is an explicit, user-initiated request, so it's the right place to retry after an
 * earlier denial too.
 *
 * Feedback plan RW-LT-05: one request at a time (a synchronous guard covers rapid
 * activation) with a busy state; each failed request yields one explanatory notification
 * that names the manual alternative (pan/zoom, search) — a denied permission is not
 * reported as a generic error; and a found position produces no toast (the marker and
 * recentering are the feedback).
 *
 * Controlled mode (`onRequest` + `isLocating`): the Centers screen owns acquisition in its
 * device-location controller (DRRM routing R1) and reports outcomes in its status card, so
 * the button only forwards the request and mirrors the busy state. */
export function LocateButton(
  props:
    | { onLocated: (position: { lat: number; lng: number }) => void; onRequest?: never; isLocating?: never }
    | { onRequest: () => void; isLocating: boolean; onLocated?: never },
) {
  const map = useMap();
  const [selfLocating, setIsLocating] = useState(false);
  const isLocating = props.onRequest ? props.isLocating : selfLocating;
  const requestingRef = useRef(false);

  // `getCurrentPosition` can't be cancelled, and its callback can fire after the map has
  // been unmounted (e.g. switching the Centers list/map toggle, toggling fullscreen, or
  // navigating away while the fix is pending). Touching a removed Leaflet map — `map.flyTo`
  // reads the deleted `_mapPane` — throws "Cannot read properties of undefined (reading
  // '_leaflet_pos')", so bail out of the callbacks once we're gone.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleClick() {
    if (props.onRequest) {
      if (!props.isLocating) props.onRequest();
      return;
    }
    const onLocated = props.onLocated;
    if (requestingRef.current) return;
    const attempt = beginAttempt('locate-me');
    if (!('geolocation' in navigator)) {
      notify.error("This browser doesn't support location access.", {
        id: attempt,
        description: 'You can still pan and zoom the map, or search for a place.',
      });
      return;
    }
    requestingRef.current = true;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        requestingRef.current = false;
        if (!mountedRef.current) return;
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocated(next);
        map.flyTo([next.lat, next.lng], 17);
        setIsLocating(false);
      },
      (failure) => {
        requestingRef.current = false;
        // The map may be gone, but the resident is still waiting on an answer: report it.
        if (failure.code === 1) {
          notify.error('Location access is blocked.', {
            id: attempt,
            description: "Allow location in your browser's site settings to use this. You can still pan and zoom the map.",
          });
        } else {
          notify.error("We couldn't find your location.", {
            id: attempt,
            description: 'Check that location services are on and try again. You can still pan and zoom the map.',
          });
        }
        if (mountedRef.current) setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLocating}
      aria-busy={isLocating || undefined}
      title="Show my location"
      aria-label="Show my current location"
      className="absolute bottom-20 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 disabled:opacity-60">
      <LocateFixed className={`h-4 w-4 text-foreground/80 ${isLocating ? 'animate-pulse motion-reduce:animate-none' : ''}`} strokeWidth={2} />
    </button>
  );
}
