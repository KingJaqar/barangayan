import type { MapEvacuationMarker, MapIncidentMarker } from '@barangayan/shared';
import { MapPin, User } from 'lucide-react';

import { StatusPill } from '@/components/shared/status-pill';

/** Note: incident markers don't deep-link to a detail route — reports/[incidentId]
 * is Phase 6 scope (per the plan's file tree, added there for confirm/withdraw/photo
 * carousel) and doesn't exist yet. This popup is read-only summary info until then. */
export function IncidentPopupContent({ marker }: { marker: MapIncidentMarker }) {
  return (
    <div className="min-w-56 space-y-2.5 p-1">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="h-3 w-3 text-primary" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold leading-snug">{marker.label}</p>
      </div>
      {marker.categoryName ? (
        <span
          className="ml-7 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: `${marker.categoryColor}18`, color: marker.categoryColor }}>
          {marker.categoryName}
        </span>
      ) : null}
      {marker.address ? <p className="ml-7 text-xs text-muted-foreground">{marker.address}</p> : null}
      <div className="ml-7">
        <StatusPill status={marker.status} />
      </div>
    </div>
  );
}

export function EvacuationPopupContent({ marker }: { marker: MapEvacuationMarker }) {
  return (
    <div className="min-w-56 space-y-2 p-1">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
          <MapPin className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold leading-snug">{marker.label}</p>
      </div>
      {marker.capacity != null ? (
        <div className="ml-7 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" strokeWidth={2} />
          <span>
            {marker.currentOccupancy ?? 0} / {marker.capacity} occupied
          </span>
        </div>
      ) : null}
      <a
        href="/emergency/centers"
        className="ml-7 inline-block text-xs font-semibold text-primary hover:underline">
        View in Evacuation Centers →
      </a>
    </div>
  );
}
