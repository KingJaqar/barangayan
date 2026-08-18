'use client';

import Link from 'next/link';
import { MapPin, User } from 'lucide-react';
import type { MapIncidentMarker, MapEvacuationMarker } from '@barangayan/shared';
import { IncidentStatusPill } from '@/app/(admin)/incident-reports/incident-table';

interface IncidentPopupContentProps {
  marker: MapIncidentMarker;
}

export function IncidentPopupContent({ marker }: IncidentPopupContentProps) {
  return (
    <div className="min-w-56 space-y-2.5 p-1">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10">
          <MapPin className="h-3 w-3 text-[var(--accent)]" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{marker.label}</p>
      </div>
      {marker.categoryName && (
        <span
          className="ml-7 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            backgroundColor: `${marker.categoryColor}18`,
            color: marker.categoryColor,
          }}>
          {marker.categoryName}
        </span>
      )}
      <div className="ml-7">
        <IncidentStatusPill status={marker.status} />
      </div>
      <div className="ml-7 pt-1">
        <Link
          href={`/incident-reports?tab=open&q=${encodeURIComponent(marker.label)}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] transition-colors duration-200 hover:text-[var(--accent-strong)] hover:underline">
          View in Incident Reports
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 group-hover:translate-x-0.5">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

interface EvacuationPopupContentProps {
  marker: MapEvacuationMarker;
}

export function EvacuationPopupContent({ marker }: EvacuationPopupContentProps) {
  return (
    <div className="min-w-56 space-y-2 p-1">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
          <MapPin className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{marker.label}</p>
      </div>
      {marker.capacity !== null && marker.capacity !== undefined && (
        <div className="ml-7 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <User className="h-3 w-3" strokeWidth={2} />
          <span>
            {marker.currentOccupancy ?? 0} / {marker.capacity} occupied
          </span>
        </div>
      )}
    </div>
  );
}
