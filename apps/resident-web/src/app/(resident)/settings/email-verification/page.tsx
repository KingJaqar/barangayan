import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EmailVerificationForm } from './verification-form';

export const metadata = { title: 'Email Verification' };
export default async function EmailVerificationPage({ searchParams }: { searchParams: Promise<{ changeEmail?: string; emailChangeError?: string }> }) {
  const { user } = await requireUser();
  const client = await createSupabaseServerClient();
  const [{ data, error }, { data: auth, error: authError }, params] = await Promise.all([
    client.from('profiles').select('email,email_verification_status').eq('id', user.id).single(),
    client.auth.getUser(),
    searchParams,
  ]);
  return <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Email Verification</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Confirm your email address to complete your account setup.</p>
    </div>
    {params.emailChangeError === '1' ? <p role="alert" className="rounded-xl border border-border bg-muted/40 p-4 text-sm">Unable to complete email confirmation. Check confirmation below or request a new confirmation email.</p> : null}
    {error || !data || authError || auth.user?.id !== user.id ? <p role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm">Unable to load your profile. Reload and try again.</p> :
      <EmailVerificationForm key={`${user.id}:${auth.user.email}:${data.email}:${auth.user.new_email}:${params.changeEmail}`} userId={user.id} email={auth.user.email ?? ''} profileEmail={data.email} initialStatus={data.email_verification_status} pendingEmail={auth.user.new_email ?? ''} changeEmail={params.changeEmail === '1'} />}
  </div>;
}
