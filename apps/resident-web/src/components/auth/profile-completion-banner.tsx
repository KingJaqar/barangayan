import Link from 'next/link';
import { needsResidentProfile } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function ProfileCompletionBanner({ userId }: { userId: string }) {
  try {
    if (!await needsResidentProfile(await createSupabaseServerClient(), userId)) return null;
  } catch {
    return <p role="status" className="p-4 text-sm">Your profile could not be checked. You can browse information; reconnect before using resident services.</p>;
  }
  return <aside className="border-b bg-card p-4 text-sm">You can browse community information now. Complete your profile before requesting documents, joining health services, or submitting reports. <Link className="font-semibold text-primary underline" href="/complete-profile">Complete profile</Link></aside>;
}
