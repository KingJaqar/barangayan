import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AboutUsForm } from './about-us-form';

export default async function AboutUsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const barangayId = profile?.barangay_id ?? '';

  const { data: about } = await supabase
    .from('about_us')
    .select('*')
    .eq('barangay_id', barangayId)
    .is('deleted_at', null)
    .maybeSingle();

  const { data: developers } = about
    ? await supabase
        .from('developer_profiles')
        .select('*')
        .eq('about_us_id', about.id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
    : { data: [] };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AboutUsForm barangayId={barangayId} initialAbout={about ?? null} initialDevelopers={developers ?? []} />
    </div>
  );
}
