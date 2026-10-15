import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './home.module.css';

/**
 * The actual landing-page hero — real website copy + CTAs (Sign Up / Log In), not a
 * dashboard shell waiting for content. Replaces the old dashed-border "Log in to see
 * your requests" box, which read as an app empty-state, not a homepage.
 */
export function GuestHero() {
  return (
    <div className={`${styles.hero} ${styles.guestHero}`}>
      <p className={styles.eyebrow}>Connected to your community</p>
      <h1>Your barangay.<br />Closer than ever.</h1>
      <p className={styles.heroDescription}>
        Request documents, report incidents, and stay connected with your barangay — all from one place, without
        the trip to the hall.
      </p>
      <div className={styles.guestCtas}>
        <Link href="/register" className={styles.primaryCta}>Get Started <ArrowRight aria-hidden size={16} /></Link>
        <Link href="/login" className={styles.secondaryCta}>Log In</Link>
      </div>
    </div>
  );
}
