import Link from 'next/link';
import styles from '@/components/admin/search/search.module.css';
export default function SearchNotFound() {
  return <div className={styles.empty}><h1>Record unavailable</h1><p>This record may have been archived or your access may have changed.</p><Link href="/search">Back to search</Link></div>;
}
