'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { QrInstructionsTab } from './qr-instructions-tab';
import { QrCodesTab } from './qr-codes-tab';

type Tab = 'instructions' | 'qr_codes';

export function ClientWrapper({
  initialContent,
  initialCenters,
  barangayId,
}: {
  initialContent: any[];
  initialCenters: any[];
  barangayId: string;
}) {
  const [tab, setTab] = useState<Tab>('instructions');
  const [isLive, setIsLive] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('admin-emergency-qr')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_qr_content',
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

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex rounded-full border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-900">
          <button
            onClick={() => setTab('instructions')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === 'instructions' ? 'bg-[var(--accent)] text-white' : 'text-zinc-600 dark:text-zinc-300'
            }`}>
            Instructions
          </button>
          <button
            onClick={() => setTab('qr_codes')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === 'qr_codes' ? 'bg-[var(--accent)] text-white' : 'text-zinc-600 dark:text-zinc-300'
            }`}>
            QR Codes
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-zinc-300'}`}>
            {isLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />}
          </span>
          <span className="text-xs text-zinc-500">{isLive ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {tab === 'instructions' ? (
        <QrInstructionsTab initialContent={initialContent} barangayId={barangayId} />
      ) : (
        <QrCodesTab initialCenters={initialCenters} barangayId={barangayId} />
      )}
    </div>
  );
}
