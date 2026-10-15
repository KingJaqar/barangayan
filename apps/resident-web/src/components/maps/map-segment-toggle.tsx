'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Building2, MapPin } from 'lucide-react';
import styles from './maps.module.css';

/** Incidents / Evacuation tab switcher — same layoutId-pill pattern as
 * emergency-segment-nav.tsx, rather than admin-web's ref-measured indicator, to match
 * this app's own established Framer Motion convention. */
export function MapSegmentToggle({
  activeTab,
  onChange,
  incidentCount,
  evacuationCount,
}: {
  activeTab: 'incidents' | 'evacuation';
  onChange: (tab: 'incidents' | 'evacuation') => void;
  incidentCount: number;
  evacuationCount: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <div className={styles.segments} role="group" aria-label="Map view">
      {(['incidents', 'evacuation'] as const).map((tab) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            aria-pressed={active}
            className={styles.segment}>
            {active ? (
              <motion.span
                layoutId="map-segment-pill"
                className={styles.segmentIndicator}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.15, duration: 0.35 }}
              />
            ) : null}
            <span className={styles.segmentLabel}>
              {tab === 'incidents' ? <MapPin size={18} aria-hidden /> : <Building2 size={18} aria-hidden />}
              {tab === 'incidents' ? 'Incidents' : 'Evacuation'}
              <span className={styles.segmentCount}>{tab === 'incidents' ? incidentCount : evacuationCount}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
