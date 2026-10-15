'use client';
import styles from '@/components/admin/search/search.module.css';
export default function SearchError({ reset }: { reset: () => void }) {
  return <div className={styles.empty} role="alert"><h2>Could not load this record</h2><p>Please check your connection and try again.</p>
    <button type="button" onClick={reset}>Try again</button></div>;
}
