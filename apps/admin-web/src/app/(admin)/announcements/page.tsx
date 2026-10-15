import styles from '@/components/admin/content-workspace.module.css';
import { ContentCreatePanel } from '@/components/admin/content-create-panel';
import { RecordArchiveLink } from '@/components/admin/record-archive-link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AnnouncementCatalog } from './announcement-catalog';
import { AnnouncementForm } from './announcement-form';

// Admin CRUD for announcements — unlocked by the 0011 migration's
// "admins can manage announcements in their barangay" RLS policy.
export default async function AnnouncementsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });

  return (
    <div className={styles.page}>
      <ContentCreatePanel
        title="Announcements"
        description="Create and manage barangay announcements pushed to residents."
        forms={[
          { label: "Create new announcement", title: "New announcement",
            description: "Write the announcement, then choose its category and publication details.",
            content: <AnnouncementForm barangayId={profile?.barangay_id ?? ''} /> },
        ]}
      />

      <RecordArchiveLink name="announcements" />
      <AnnouncementCatalog announcements={announcements ?? []} />
    </div>
  );
}
