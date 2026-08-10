import { createSupabaseServerClient } from '@/lib/supabase/server';

import { EvacuationCenterForm } from './evacuation-center-form';
import { EvacuationCenterRow } from './evacuation-center-row';

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
    .order('name', { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evacuation Centers</h1>
          <p className="text-sm text-zinc-500">
            Create and manage barangay evacuation centers visible to residents.
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          New Center
        </h2>
        <EvacuationCenterForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        All Centers
      </h2>
      <div className="flex flex-col gap-3">
        {(centers ?? []).map((center) => (
          <EvacuationCenterRow key={center.id} center={center} />
        ))}
        {(centers ?? []).length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            No evacuation centers yet — create one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
