import { createSupabaseServerClient } from '@/lib/supabase/server';

import { SettingsForm } from './settings-form';
import styles from './settings.module.css';

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('barangay_id')
    .eq('id', user!.id)
    .single();

  if (!profile?.barangay_id) {
    return (
      <div className={styles.workspace}>
        <header className={styles.hero}><h1>Settings</h1></header>
        <p className={styles.notice}>No barangay assigned to your account.</p>
      </div>
    );
  }

  return (
    <SettingsForm barangayId={profile.barangay_id} />
  );
}
