'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import localFont from 'next/font/local';
import { safeResidentRedirect } from '@barangayan/shared';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const googleSans = localFont({ src: './google-sans-medium.ttf', weight: '500', style: 'normal', display: 'swap' });

export function GoogleButton({ label, next = null, link = false }: { label: string; next?: string | null; link?: boolean }) {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError(null);
    try {
      const client = createSupabaseBrowserClient();
      const options = { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeResidentRedirect(next))}`, skipBrowserRedirect: true };
      const result = link ? await client.auth.linkIdentity({ provider: 'google', options }) : await client.auth.signInWithOAuth({ provider: 'google', options });
      if (result.error || !result.data.url) throw new Error('Unable to start Google sign-in. Check your connection and try again.');
      window.location.assign(result.data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in failed. Please retry.');
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
        <span aria-hidden="true" className={loading ? 'h-[18px] w-[18px] animate-spin rounded-full border-2 border-[#4285f4] border-t-transparent' : 'h-[18px] w-[18px]'} />
      </Button>
      {loading && <p role="status" className="sr-only">Connecting to Google…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
