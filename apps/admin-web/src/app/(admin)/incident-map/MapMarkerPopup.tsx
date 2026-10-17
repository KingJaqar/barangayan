'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin, Users } from 'lucide-react';
import type { MapIncidentMarker, MapEvacuationMarker } from '@barangayan/shared';
import styles from './incident-map.module.css';

const STATUS_LABELS: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', withdrawn: 'Withdrawn', unresolved: 'Unresolved' };

export function IncidentPopupContent({ marker }: { marker: MapIncidentMarker }) {
  return (
    <div className={styles.popup}>
      <div className={styles.popupTitle}><MapPin size={16} aria-hidden="true" /><p className={styles.popupHeading}>{marker.label}</p></div>
      {marker.categoryName && <span className={styles.popupCategory}><span className={styles.categoryDot} style={{ '--category-color': marker.categoryColor } as CSSProperties} />{marker.categoryName}</span>}
      {marker.address && <p className={styles.popupAddress}>{marker.address}</p>}
      <div><span className={styles.popupStatus}>{STATUS_LABELS[marker.status] ?? marker.status}</span></div>
      <Link href={`/incident-reports?tab=open&q=${encodeURIComponent(marker.label)}`} className={styles.popupLink}>View in Incident Reports <ArrowUpRight size={14} aria-hidden="true" /></Link>
    </div>
  );
}

export function EvacuationPopupContent({ marker }: { marker: MapEvacuationMarker }) {
  return (
    <div className={styles.popup}>
      <div className={styles.popupTitle}><MapPin size={16} aria-hidden="true" /><p className={styles.popupHeading}>{marker.label}</p></div>
      {marker.capacity !== null && marker.capacity !== undefined && <div className={styles.occupancy}><Users size={14} aria-hidden="true" /><span>{marker.currentOccupancy ?? 0} / {marker.capacity} occupied</span></div>}
    </div>
  );
}
