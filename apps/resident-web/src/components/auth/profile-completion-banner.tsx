import { Info } from 'lucide-react';
import { needsResidentProfile } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import styles from './profile-completion-banner.module.css';
import { ProfileCompletionNotice } from './resident-action-notices';

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
  return <ProfileCompletionNotice />;
}
