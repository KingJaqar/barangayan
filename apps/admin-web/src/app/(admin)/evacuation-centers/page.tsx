import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ContentCreatePanel } from '@/components/admin/content-create-panel';
import { RecordArchiveLink } from '@/components/admin/record-archive-link';
import styles from '@/components/admin/content-workspace.module.css';

import { EvacuationCenterCatalog } from './evacuation-center-catalog';
import { EvacuationCenterForm } from './evacuation-center-form';

// Admin CRUD for evacuation centers — unlocked by RLS policy allowing admins
// to manage centers in their barangay.
export default async function EvacuationCentersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: centers } = await supabase
    .from('evacuation_centers')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  return (
    <div className={styles.page}>
      <ContentCreatePanel
        title="Evacuation Centers"
        description="Create and manage barangay evacuation centers visible to residents."
        forms={[{
          label: 'Create new center', title: 'New evacuation center',
          description: 'Add the center’s location, capacity, facilities, and contact details.',
          content: <EvacuationCenterForm barangayId={profile?.barangay_id ?? ''} />,
        }]}
      />

      <RecordArchiveLink name="evacuation-centers" />
      <EvacuationCenterCatalog centers={centers ?? []} />
    </div>
  );
}
