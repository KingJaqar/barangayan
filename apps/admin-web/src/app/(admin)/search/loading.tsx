import { Spinner } from '@/components/loading/spinner';
import { SearchSkeleton } from '@/components/admin/search/search-skeleton';
import styles from '@/components/admin/search/search.module.css';
export default function SearchLoading() {
  return <div className={`${styles.page} ${styles.routeLoading}`}><p role="status" aria-live="polite" className={styles.resultsStatus}>
    <Spinner size="compact" /> Loading search content…</p><SearchSkeleton /></div>;
}
