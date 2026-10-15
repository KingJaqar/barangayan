import { challengeSchema } from '@/lib/admin-profile/schema';
import { ProofPanel } from './proof-panel';
import { profileCapabilities } from '@/lib/admin-profile/server';

export default async function ProfileProofPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (!profileCapabilities().credentials) return <main className="p-6">Account verification is awaiting sign-in and callback checks.</main>;
  const request = challengeSchema.safeParse(params.request);
  const challenge = challengeSchema.safeParse(params.challenge);
  if (!request.success || typeof params.purpose !== 'string' || !['admin', 'resident'].includes(params.purpose) || (params.purpose === 'resident' && !challenge.success)) return <main className="p-6">Open account verification from your admin profile.</main>;
  return <ProofPanel purpose={params.purpose === 'admin' ? 'admin' : 'resident'} request={request.data} challenge={challenge.success ? challenge.data : undefined} />;
}
