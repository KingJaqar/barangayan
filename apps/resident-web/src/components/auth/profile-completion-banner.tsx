import Link from 'next/link';
import { ArrowRight, Info, UserRoundPen } from 'lucide-react';
import { needsResidentProfile } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import styles from './profile-completion-banner.module.css';

export async function ProfileCompletionBanner({ userId }: { userId: string }) {
  try {
    if (!await needsResidentProfile(await createSupabaseServerClient(), userId, { includeAdmin: true })) return null;
  } catch {
    return (
      <aside role="status" className={styles.banner}>
        <span className={styles.icon}><Info size={20} aria-hidden="true" /></span>
        <div className={styles.copy}>
          <h2 className={styles.title}>Profile check unavailable</h2>
          <p className={styles.description}>You can still browse community information. Reconnect before using resident services.</p>
        </div>
      </aside>
    );
  }
  return (
    <aside aria-label="Complete your resident profile" className={styles.banner}>
      <span className={styles.icon}><UserRoundPen size={20} aria-hidden="true" /></span>
      <div className={styles.copy}>
        <h2 className={styles.title}>Your next step: complete your profile</h2>
        <p className={styles.description}>
          Browse freely. Complete your profile to request documents, join health services, and submit reports.
        </p>
      </div>
      <Link className={styles.action} href="/settings/profile">
        Complete profile <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  );
}
