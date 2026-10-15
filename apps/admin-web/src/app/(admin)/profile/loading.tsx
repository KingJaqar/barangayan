import styles from './profile.module.css';
export default function ProfileLoading() {
  return <div className={styles.page} aria-busy="true"><p role="status" className="mb-6">Loading your admin profile…</p><div className={styles.grid}><div className={`${styles.skeleton} ${styles.wide}`} /><div className={styles.skeleton} /><div className={styles.skeleton} /></div></div>;
}
