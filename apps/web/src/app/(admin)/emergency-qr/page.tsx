import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ClientWrapper } from './client-wrapper';

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
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Emergency QR</h1>
        <p className="text-sm text-zinc-500">
          Manage evacuation center QR codes and instructional content.
        </p>
      </div>
      <ClientWrapper
        initialContent={content ?? []}
        initialCenters={centers ?? []}
        barangayId={profile?.barangay_id ?? ''}
      />
    </div>
  );
}
