import styles from './search.module.css';
export function SearchSkeleton({ compact = false, count = 3 }: { compact?: boolean; count?: number }) {
  return <div aria-hidden="true" className={`${styles.skeletons} ${compact ? styles.compactSkeletons : ''}`}>
    {Array.from({ length: count }, (_, index) => <div key={index} className={styles.skeletonCard}>
      <span className={styles.skeletonIcon} /><span className={styles.skeletonText}>
        <span className={styles.skeletonTitle} /><span className={styles.skeletonPreview} /><span className={styles.skeletonMeta} />
      </span>
    </div>)}
  </div>;
}
