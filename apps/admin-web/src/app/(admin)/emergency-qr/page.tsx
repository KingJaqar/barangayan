import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ClientWrapper } from './client-wrapper';
import { EmergencyQrHeader } from './emergency-qr-header';
import styles from './emergency-qr.module.css';

export default async function EmergencyQrPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  const { data: content } = await supabase
    .from('emergency_qr_content')
    .select('*')
    .eq('barangay_id', profile?.barangay_id ?? '')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  const { data: centers } = await supabase
    .from('evacuation_centers')
    .select('*')
    .eq('barangay_id', profile?.barangay_id ?? '')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return (
    <div className={styles.page}>
      <EmergencyQrHeader />
      <ClientWrapper
        initialContent={content ?? []}
        initialCenters={centers ?? []}
        barangayId={profile?.barangay_id ?? ''}
      />
    </div>
  );
}
