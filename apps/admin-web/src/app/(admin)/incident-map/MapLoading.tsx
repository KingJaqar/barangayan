import { Spinner } from '@/components/loading/spinner';
import styles from './incident-map.module.css';

export function MapLoading() {
  return <div className={styles.workspace} aria-busy="true">
    <div className={styles.mapFrame}>
      <div className={styles.initialLoading} role="status"><Spinner /> Loading community map…</div>
    </div>
  </div>;
}
