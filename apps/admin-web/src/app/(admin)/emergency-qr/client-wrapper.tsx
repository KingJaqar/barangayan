'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Tables } from '@barangayan/shared';
import { QrInstructionsTab } from './qr-instructions-tab';
import { QrCodesTab } from './qr-codes-tab';
import { BookOpen, QrCode } from 'lucide-react';
import styles from './emergency-qr.module.css';

type Tab = 'instructions' | 'qr_codes';

export function ClientWrapper({
  initialContent,
  initialCenters,
  barangayId,
}: {
  initialContent: Tables<'emergency_qr_content'>[];
  initialCenters: Tables<'evacuation_centers'>[];
  barangayId: string;
}) {
  const [tab, setTab] = useState<Tab>('instructions');
  const [isLive, setIsLive] = useState(false);
  const router = useRouter();

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
      <div className={styles.navigation}>
        <nav className={styles.tabs} aria-label="Emergency QR views">
          <button
            onClick={() => setTab('instructions')}
            aria-pressed={tab === 'instructions'} aria-controls="emergency-qr-view">
            <BookOpen size={16} aria-hidden="true" /> Instructions
          </button>
          <button
            onClick={() => setTab('qr_codes')}
            aria-pressed={tab === 'qr_codes'} aria-controls="emergency-qr-view">
            <QrCode size={16} aria-hidden="true" /> QR Codes
            <span className={styles.tabCount}>{initialCenters.length}</span>
          </button>
        </nav>
        <div className={styles.live} role="status">
          <span className={styles.liveDot} data-live={isLive}>
            {isLive && <span />}
          </span>
          <span>{isLive ? 'Live updates' : 'Offline'}</span>
        </div>
      </div>

      <section id="emergency-qr-view" aria-label={tab === 'instructions' ? 'Instructions' : 'QR Codes'}>
        {tab === 'instructions' ? (
          <QrInstructionsTab initialContent={initialContent} barangayId={barangayId} />
        ) : (
          <QrCodesTab initialCenters={initialCenters} />
        )}
      </section>
    </div>
  );
}
