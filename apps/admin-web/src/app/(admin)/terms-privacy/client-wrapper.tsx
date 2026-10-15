'use client';

import type { Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { ContentForm } from './content-form';
import styles from './terms-privacy.module.css';

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, barangayId]);

  const current = section === 'terms_of_service' ? initialTerms : initialPrivacy;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Resident experience / Legal content</p>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>Your documents <span>02</span></p>
          <nav aria-label="Legal documents" className={styles.documents}>
            {([
              { id: 'terms_of_service', label: 'Terms of Service', description: 'Guidelines for using the app', number: '01' },
              { id: 'privacy_policy', label: 'Privacy Policy', description: 'How resident data is handled', number: '02' },
            ] as const).map(({ id, label, description, number }) => (
              <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)} className={styles.document}>
                <span className={styles.documentTop}><span>{number}</span></span>
                <strong>{label}<ArrowUpRight size={16} aria-hidden="true" /></strong>
                <span className={styles.documentDescription}>{description}</span>
              </button>
            ))}
          </nav>
        </aside>
        <ContentForm key={section} section={section} barangayId={barangayId} initial={current} />
      </div>
    </div>
  );
}
