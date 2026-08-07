import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ResidentDirectory } from './resident-directory';

// Residents can also self-register via the mobile Register flow (Supabase Auth +
// the "residents can create their own profile" RLS policy) — this page adds the
// admin-side counterpart: create (via the /api/admin/residents route, since
// provisioning auth.users needs the service_role key), inline edit, and soft
// delete, backed by the 0009 migration's admin insert/update policies on profiles.
export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: residents } = await supabase
    .from('profiles')
    .select('id, full_name, mobile_number, home_address, created_at')
    .eq('role', 'resident')
    .is('deleted_at', null)
    .order('full_name');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Resident Directory</h1>
        <p className="text-sm text-zinc-500">Registered residents in your barangay.</p>
      </div>

      <ResidentDirectory residents={residents ?? []} initialQuery={q ?? ''} />
    </div>
  );
}
