'use client';

import { MapPin, Warehouse } from 'lucide-react';
import styles from './incident-map.module.css';

interface MapSegmentToggleProps {
  activeTab: 'incidents' | 'evacuation';
  onChange: (tab: 'incidents' | 'evacuation') => void;
}

export function MapSegmentToggle({ activeTab, onChange }: MapSegmentToggleProps) {
  return (
    <div className={styles.segments} role="group" aria-label="Map layer">
      <div aria-hidden="true" className={styles.segmentIndicator} style={{ transform: `translateX(${activeTab === 'evacuation' ? '100%' : '0'})` }} />
      <button type="button" className={styles.segment} onClick={() => onChange('incidents')} aria-pressed={activeTab === 'incidents'}>
        <MapPin size={14} aria-hidden="true" /> Incidents
      </button>
      <button type="button" className={styles.segment} onClick={() => onChange('evacuation')} aria-pressed={activeTab === 'evacuation'}>
        <Warehouse size={14} aria-hidden="true" /> Evacuation
      </button>
    </div>
  );
}
