import { ArrowUpRight, BadgeCheck, MapPin } from 'lucide-react';

import { FACILITY_ICON_NAMES, FACILITY_LABELS, renderIonicon } from '@/lib/ionicon-map';
import styles from './emergency.module.css';

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
 * identical (>=100% error/FULL, >=80% warning, else the resident's accent). */
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
  const barColor = isFull ? 'var(--em-danger)' : isHigh ? 'var(--em-warning)' : 'var(--em-accent)';
  const displayOccupancy = isFull ? 'FULL' : `${occupancyPercent}%`;
  const capacityText = capacity != null ? `(${currentOccupancy.toLocaleString()}/${capacity.toLocaleString()})` : '';

  return (
    <div
      onClick={onClick}
      // Clickable cards are real keyboard targets: focusable, activated with Enter/Space.
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': selected,
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onClick();
              }
            },
          }
        : {})}
      className={styles.centerCard}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={styles.centerName}>{name}</p>
            {verified ? <BadgeCheck size={16} className="shrink-0 text-primary" /> : null}
          </div>
          <p className={styles.centerAddress}>{address ?? 'No address provided'}</p>
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
      {onClick ? <div className={styles.centerFooter}><span>View center on map</span><ArrowUpRight size={16} aria-hidden="true" /></div> : null}
    </div>
  );
}
