import { createSupabaseServerClient } from '@/lib/supabase/server';

import { NewReportForm } from './new-report-form';

export default async function NewReportPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: categories }, { data: zones }] = await Promise.all([
    supabase.from('incident_categories').select('id, name, color, is_trash_related').order('name'),
    supabase.from('waste_zones').select('id, name').eq('is_active', true).order('sort_order'),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Report an Incident</h1>
        <p className="text-sm text-zinc-500">Flag a hazard, dispute, or concern for the barangay to review.</p>
      </div>

      <NewReportForm categories={categories ?? []} zones={zones ?? []} />
    </div>
  );
}
