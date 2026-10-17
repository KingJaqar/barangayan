'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import localFont from 'next/font/local';
import { safeResidentRedirect } from '@barangayan/shared';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/loading';
import { queueLoginNotification } from '@/lib/auth/session-feedback';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { beginAttempt, notify } from '@/lib/notify';

const googleSans = localFont({ src: './google-sans-medium.ttf', weight: '500', style: 'normal', display: 'swap' });

export function GoogleButton({ label, next = null, link = false }: { label: string; next?: string | null; link?: boolean }) {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Starting OAuth leaves this page for Google. If the resident comes Back and the
  // browser restores this page from its back/forward cache, release the pending state
  // instead of showing "Connecting…" forever. Nothing here claims sign-in succeeded.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      busy.current = false;
      setLoading(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
  async function start() {
    if (busy.current) return;
    const attempt = beginAttempt(link ? 'google-link' : 'google-sign-in');
    busy.current = true; setLoading(true); setError(null);
    try {
      const client = createSupabaseBrowserClient();
      const options = { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeResidentRedirect(next))}`, skipBrowserRedirect: true };
      const result = link ? await client.auth.linkIdentity({ provider: 'google', options }) : await client.auth.signInWithOAuth({ provider: 'google', options });
      if (result.error || !result.data.url) throw new Error('Unable to start Google sign-in. Check your connection and try again.');
      if (!link) queueLoginNotification();
      window.location.assign(result.data.url);
    } catch {
      const message = link ? "Couldn't connect your Google account. Please try again." : "Couldn't connect to Google. Please try again.";
      setError(message);
      notify.error(message, { id: attempt });
      busy.current = false; setLoading(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={start}
        disabled={loading}
        aria-busy={loading}
        className={`${googleSans.className} grid min-h-12 w-full grid-cols-[18px_1fr_18px] gap-2.5 border-[#747775] bg-white px-3 text-sm font-medium text-[#1f1f1f] hover:bg-[#f8faff] active:bg-[#eef3fc] disabled:opacity-70 focus-visible:ring-[#4285f4]`}>
        <Image src="/google-g.png" alt="" width={200} height={204} sizes="18px" className="h-auto w-[18px] shrink-0" />
        <span>{label}</span>
        <span aria-hidden="true" className="flex h-[18px] w-[18px] items-center justify-center text-[#4285f4]">{loading ? <Spinner className="size-[18px]" /> : null}</span>
      </Button>
      {loading && <p role="status" className="sr-only">Connecting to Google…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
