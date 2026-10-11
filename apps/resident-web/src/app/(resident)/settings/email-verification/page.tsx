import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EmailVerificationForm } from './verification-form';

export const metadata = { title: 'Email Verification' };
export default async function EmailVerificationPage() {
  const { user } = await requireUser();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.from('profiles').select('email,email_verification_status').eq('id', user.id).single();
  return <div className="mx-auto max-w-xl space-y-4 px-4 py-5">
    <h1 className="text-xl font-bold">Email Verification</h1>
    {error || !data ? <p role="alert">Unable to load your profile. Reload and try again.</p> :
      <EmailVerificationForm key={`${user.id}:${data.email}`} userId={user.id} email={user.email ?? ''} profileEmail={data.email} initialStatus={data.email_verification_status} />}
  </div>;
}
