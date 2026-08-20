import { BadgeCheck, MapPin } from 'lucide-react';

import { FACILITY_ICON_NAMES, FACILITY_LABELS, renderIonicon } from '@/lib/ionicon-map';

export interface EvacuationCenterCardProps {
  name: string;
  address: string | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  currentOccupancy: number;
  capacity: number | null;
  facilities: string[];
  verified?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

/** Web port of evacuation-center-card.tsx — occupancy bar color/threshold logic kept
 * identical (>=100% red/FULL, >=80% amber, else brand green). */
export function EvacuationCenterCard({
  name,
  address,
  distanceKm,
  estimatedMinutes,
  currentOccupancy,
  capacity,
  facilities,
  verified = false,
  onClick,
  selected = false,
}: EvacuationCenterCardProps) {
  const occupancyFraction = capacity && capacity > 0 ? currentOccupancy / capacity : 0;
  const occupancyPercent = Math.round(occupancyFraction * 100);
  const isFull = occupancyPercent >= 100;
  const isHigh = occupancyPercent >= 80;
  const barColor = isFull ? '#DC2626' : isHigh ? '#D97706' : '#0F6E5B';
  const displayOccupancy = isFull ? 'FULL' : `${occupancyPercent}%`;
  const capacityText = capacity != null ? `(${currentOccupancy.toLocaleString()}/${capacity.toLocaleString()})` : '';

  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 ${onClick ? 'cursor-pointer transition-colors hover:border-primary/50' : ''} ${selected ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold">{name}</p>
            {verified ? <BadgeCheck size={16} className="shrink-0 text-primary" /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{address ?? 'No address provided'}</p>
        </div>
        {distanceKm != null ? (
          <div className="shrink-0 text-right">
            <p className="flex items-center gap-1 text-xs font-semibold">
              <MapPin size={12} /> {distanceKm.toFixed(1)} km
            </p>
            {estimatedMinutes != null ? <p className="text-[11px] text-muted-foreground">Est. {estimatedMinutes} min</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Occupancy</span>
        <span className="font-bold" style={{ color: barColor }}>
          {displayOccupancy} {capacityText}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ backgroundColor: barColor, width: `${Math.min(occupancyFraction * 100, 100)}%` }} />
      </div>

      {facilities.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {facilities.map((key) => {
            const label = FACILITY_LABELS[key];
            if (!label) return null;
            return (
              <span key={key} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                {renderIonicon(FACILITY_ICON_NAMES[key], { size: 12, strokeWidth: 2 })}
                {label}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
