import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { deadlineFetch } from './transport';
import { ValidIdFlow } from './valid-id-flow';
import { ReadRetryLink } from '@/components/shared/read-failure';

export const metadata = { title: 'Valid ID' };

function UnavailableAccount({ message }: { message: string }) {
  return <div className="mx-auto max-w-2xl space-y-4 p-6">
    <h1 className="text-2xl font-bold">Valid ID</h1>
    <p role="alert">{message}</p>
    <ReadRetryLink href="/settings/valid-id" contentName="your account information" resultId={crypto.randomUUID()} />
    <Link className="ml-4 underline" href="/settings">Back to Settings</Link>
  </div>;
}

export default async function ValidIdPage() {
  const client = await createSupabaseServerClient(deadlineFetch, { retry: false });
  const account = await getOptionalUser(client, { failOnReadError: true }).catch(() => null);
  if (!account) return <UnavailableAccount message="Your account information is unavailable. Please try again." />;
  const { user, profile, profileSetupPending } = account;
  if (!user) redirect('/login?next=%2Fsettings%2Fvalid-id');
  if (profileSetupPending || !profile) return <UnavailableAccount message="Your account information is unavailable. Please try again." />;
  if (profile.role !== 'resident' && profile.role !== 'admin') return <UnavailableAccount message="Sign in with a resident account to submit an ID." />;
  return <ValidIdFlow key={user.id} userId={user.id} />;
}
