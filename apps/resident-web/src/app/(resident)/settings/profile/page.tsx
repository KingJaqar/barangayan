import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfileForm } from './profile-form';

export const metadata = { title: 'Edit Profile' };

export default async function ProfilePage() {
  const { user, profile: sessionProfile } = await requireUser();

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, middle_name, suffix, sex, email, mobile_number, house_no, street, city, employment_status, occupation, id_verification_status, avatar_url, id_type, id_photo_urls, barangay_id, household_members, email_verification_status, barangays(name)',
    )
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your personal information, address, household, and ID verification.
        </p>
      </div>
      <ProfileForm profile={profile} barangayName={sessionProfile.barangayName} />
    </div>
  );
}
