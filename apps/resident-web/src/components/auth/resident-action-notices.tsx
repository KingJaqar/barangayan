import Link from 'next/link';
import { ArrowRight, UserRoundPen } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './profile-completion-banner.module.css';

/** Shared with the resident shell; completion keeps its existing Settings destination. */
export function ProfileCompletionNotice({ actionLabel = 'Complete profile', embedded = false }: { actionLabel?: string; embedded?: boolean }) {
  return (
    <aside aria-label="Complete your resident profile" className={`${styles.banner}${embedded ? ` ${styles.embedded}` : ''}`}>
      <span className={styles.icon}><UserRoundPen size={20} aria-hidden="true" /></span>
      <div className={styles.copy}>
        <h2 className={styles.title}>Your next step: complete your profile</h2>
        <p className={styles.description}>
          Browse freely. Complete your profile to request documents, join health services, and submit reports.
        </p>
      </div>
      <Link className={styles.action} href="/settings/profile">
        {actionLabel} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  );
}

/** The existing valid ID warning and its Verify Now action. */
export function ResidentVerificationNotice({ message, href = '/settings/valid-id', children }: {
  message: string;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <aside className="my-4 rounded-xl border border-amber-500 bg-amber-50 p-4 text-zinc-900">
      <p>{message}</p>
      <a className="mt-2 inline-block font-semibold underline" href={href}>Verify Now</a>
      {children}
    </aside>
  );
}
