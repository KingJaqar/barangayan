import { Skeleton } from '@/components/loading/skeleton';
import { Spinner } from '@/components/loading/spinner';
import styles from '../archive.module.css';

export default function ArchiveLoading() {
  return <section className={styles.loading} aria-label="Archived records loading" aria-busy="true">
    <p className={styles.loadingStatus} role="status" aria-live="polite"><Spinner size="compact" />Loading archived records…</p>
    <Skeleton className="h-12 w-full max-w-lg rounded-full" />
    <div className={styles.loadingControls} aria-hidden="true">
      <Skeleton className="h-8 w-1/2" /><Skeleton className="h-8 w-1/2" />
    </div>
    <div className={styles.loadingTable} aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => <div key={index} className={styles.loadingRow}>
        <Skeleton className={index === 0 ? 'h-3 w-20 max-w-full' : 'h-3 w-3/4'} />
        <Skeleton className={index === 0 ? 'h-3 w-24 max-w-full' : 'h-3 w-5/6'} />
        <Skeleton className="h-3 w-full max-w-24" />
      </div>)}
    </div>
  </section>;
}
