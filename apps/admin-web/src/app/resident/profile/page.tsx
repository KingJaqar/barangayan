import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ProfileForm } from './profile-form';

export default async function ResidentProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, mobile_number, home_address, id_verification_status')
    .eq('id', user!.id)
    .single();

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-zinc-500">
          Keep your contact details up to date. ID document upload and photo verification are available in the mobile app.
        </p>
      </div>

      <ProfileForm profile={profile} />
    </div>
  );
}
