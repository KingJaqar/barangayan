'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { readAdminProfile } from '@/app/(admin)/profile/actions';

export default function ProfileSecurityCallback() {
  const [message, setMessage] = useState('Checking admin email confirmation…');
  useEffect(() => {
    let mounted = true;
    async function confirm() {
      const client = createSupabaseBrowserClient();
      // The existing SSR browser client detects/exchanges URL codes during
      // initialization. Await that result; a second exchange consumes the same
      // one-use code again and incorrectly reports failure after Auth success.
      const initialized = await client.auth.initialize();
      window.history.replaceState(window.history.state, '', window.location.pathname);
      if (initialized.error) { if (mounted) setMessage('This confirmation could not be completed. The link may have expired. Return to Profile to check the current sign-in email before retrying.'); return; }
      const user = await client.auth.getUser();
      const access = await readAdminProfile();
      if (!access.ok) { if (mounted) setMessage('An active admin sign-in is required to review this confirmation. Sign in again before making changes.'); return; }
      if (mounted) setMessage(user.error || !user.data.user ? 'Your sign-in expired. Sign in again to check the confirmed email.' : user.data.user.new_email ? 'Confirmation is still pending. Follow the remaining inbox confirmation, then check Profile.' : 'Confirmation checked. Profile shows your current sign-in email; your contact email is unchanged.');
    }
    void confirm().catch(() => { if (mounted) setMessage('Confirmation status is unavailable. Return to Profile and check your sign-in email before retrying.'); });
    return () => { mounted = false; };
  }, []);
  return <section className="rounded-2xl border p-6"><h1 className="text-xl font-semibold">Admin email confirmation</h1><p role="status" className="my-4">{message}</p><Link href="/profile" prefetch={false} className="underline">Return to Profile</Link></section>;
}
