import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ClientWrapper } from './client-wrapper';

export default async function TermsPrivacyPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  const { data: content } = await supabase
    .from('site_content')
    .select('*')
    .is('deleted_at', null)
    .in('section', ['terms_of_service', 'privacy_policy']);

  const terms = content?.find((c) => c.section === 'terms_of_service') ?? null;
  const privacy = content?.find((c) => c.section === 'privacy_policy') ?? null;

  return (
    <ClientWrapper barangayId={profile?.barangay_id ?? ''} initialTerms={terms} initialPrivacy={privacy} />
  );
}
