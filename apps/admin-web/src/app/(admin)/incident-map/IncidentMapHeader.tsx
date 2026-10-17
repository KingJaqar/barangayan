import { MapPin, Warehouse } from 'lucide-react';
import styles from './incident-map.module.css';

export function IncidentMapHeader({ incidentCount, centerCount }: { incidentCount: number; centerCount: number }) {
  return (
    <header className={styles.header}>
      <h1 className="sr-only">Incident map</h1>
      <dl className={styles.stats}>
        <div><dt><MapPin size={14} aria-hidden="true" /> Reported incidents</dt><dd>{incidentCount.toLocaleString()}</dd></div>
        <div><dt><Warehouse size={14} aria-hidden="true" /> Evacuation centers</dt><dd>{centerCount.toLocaleString()}</dd></div>
      </dl>
    </header>
  );
}
