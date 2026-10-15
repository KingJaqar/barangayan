import styles from '@/components/admin/content-workspace.module.css';
import { ContentCreatePanel } from '@/components/admin/content-create-panel';
import { RecordArchiveLink } from '@/components/admin/record-archive-link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { EmergencyCatalog } from './emergency-catalog';
import { EmergencyForm } from './emergency-form';

export default async function HubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: items } = await supabase
    .from('emergency_information')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false });

  return (
    <div className={styles.page}>
      <ContentCreatePanel
        title="Emergency Hub"
        description="Manage emergency guidelines and hotlines pushed to residents."
        forms={[
          { label: "Create new entry", title: "New emergency entry",
            description: "Add guidelines or hotlines and configure how they appear to residents.",
            content: <EmergencyForm barangayId={profile?.barangay_id ?? ''} /> },
        ]}
      />

      <RecordArchiveLink name="hub" />
      <EmergencyCatalog items={items ?? []} />
    </div>
  );
}
