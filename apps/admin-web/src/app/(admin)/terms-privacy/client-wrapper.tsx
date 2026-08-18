'use client';

import type { Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { ContentForm } from './content-form';

type SiteContentRow = Tables<'site_content'>;
type Section = 'terms_of_service' | 'privacy_policy';

export function ClientWrapper({
  barangayId,
  initialTerms,
  initialPrivacy,
}: {
  barangayId: string;
  initialTerms: SiteContentRow | null;
  initialPrivacy: SiteContentRow | null;
}) {
  const [section, setSection] = useState<Section>('terms_of_service');
  const [isLive, setIsLive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!barangayId) return;
    const supabase = createSupabaseBrowserClient();
    const channelName = `admin-site-content:${barangayId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: `barangay_id=eq.${barangayId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, barangayId]);

  const current = section === 'terms_of_service' ? initialTerms : initialPrivacy;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Terms & Privacy Policy</h1>
          <p className="text-sm text-zinc-500">
            Manage the legal content shown to residents in Settings.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-zinc-300'}`}>
            {isLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />}
          </span>
          <span className="text-xs text-zinc-500">{isLive ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      <div className="mb-6 flex rounded-full border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setSection('terms_of_service')}
          className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            section === 'terms_of_service' ? 'bg-[var(--accent)] text-white' : 'text-zinc-600 dark:text-zinc-300'
          }`}>
          Terms of Service
        </button>
        <button
          type="button"
          onClick={() => setSection('privacy_policy')}
          className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            section === 'privacy_policy' ? 'bg-[var(--accent)] text-white' : 'text-zinc-600 dark:text-zinc-300'
          }`}>
          Privacy Policy
        </button>
      </div>

      <ContentForm key={section} section={section} barangayId={barangayId} initial={current} />
    </div>
  );
}
