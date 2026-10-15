import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { activeAdmin, profileCapabilities, residentSection } from '@/lib/admin-profile/server';
import { ProfileWorkspace } from './profile-workspace';
import { AdminProfileMfa } from './admin-mfa';

export const metadata: Metadata = { title: 'Profile' };

export default async function AdminProfilePage() {
  const actor = await activeAdmin(true);
  if (!actor) redirect('/login');
  const capabilities = profileCapabilities();
  if (!capabilities.enabled) return <section className="mx-auto max-w-xl rounded-2xl border bg-white p-6 dark:bg-zinc-900"><h1 className="text-2xl font-bold">Admin Profile</h1><p className="mt-4">Profile access is awaiting database and account-security verification. Your existing admin tools remain available.</p></section>;
  if (actor.mfaRequired) return <AdminProfileMfa />;
  const resident = await residentSection(actor.client, actor.profile);
  return <ProfileWorkspace profile={actor.profile} barangayName={actor.barangayName} staff={actor.staff} initialResident={resident} credentialsEnabled={capabilities.credentials}
    security={{ email: actor.user.email ?? null, newEmail: actor.user.new_email ?? null, confirmed: Boolean(actor.user.email_confirmed_at), providers: [...new Set(actor.user.identities?.map(identity => identity.provider) ?? [])] }} />;
}
