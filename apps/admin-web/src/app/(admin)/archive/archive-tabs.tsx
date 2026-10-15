'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ARCHIVE_SECTIONS, archiveHref } from '@/lib/admin-tables/archive-sections';
import styles from './archive.module.css';
import { Spinner } from '@/components/loading/spinner';
import { MedicalApplicantIcon } from '@/components/admin/medical-applicant-icon';
import { HouseholdResidentsIcon } from '@/components/admin/household-residents-icon';
import { Building2, FileText, Heart, Mail, MapPin, Megaphone, ReceiptText,
  Recycle, TriangleAlert, UserRoundCog, UsersRound, type LucideIcon } from 'lucide-react';
import type { ArchiveSection } from '@/lib/admin-tables/archive-sections';

const SECTION_ICONS: Record<ArchiveSection, LucideIcon> = {
  services: FileText, announcements: Megaphone, requests: Mail, transactions: ReceiptText,
  residents: UsersRound, incidents: TriangleAlert, health: Heart, applicants: MedicalApplicantIcon,
  'waste-management': Recycle, hub: Building2, 'evacuation-centers': MapPin,
  households: HouseholdResidentsIcon, staff: UserRoundCog,
};

function ArchiveTabLabel({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return <>
    <span className={styles.tabIcon} data-pending={pending || undefined} aria-hidden="true">
      <Icon size={20} strokeWidth={2} className={styles.destinationIcon} />
      {pending ? <span className={styles.tabSpinner}><Spinner size="regular" /></span> : null}
    </span>
    <span className={styles.tabLabel} aria-hidden="true"><span>{label}</span></span>
  </>;
}

export function ArchiveTabs() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = nav.current;
    const selected = container?.querySelector('[aria-current="page"]');
    if (!container || !selected) return;
    const reveal = () => {
      const bounds = container.getBoundingClientRect(), item = selected.getBoundingClientRect();
      if (item.left < bounds.left || item.right > bounds.right) {
        container.scrollBy({ left: item.left - bounds.left - 12, behavior: 'instant' });
      }
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(container);
    return () => resize.disconnect();
  }, [pathname]);
  return <nav ref={nav} className={styles.tabs} aria-label="Archived record sections">
    {ARCHIVE_SECTIONS.map(section => <Link key={section.key} href={archiveHref(section.key)} scroll={false}
      aria-label={section.label} title={section.label}
      aria-current={pathname === archiveHref(section.key) ? 'page' : undefined} className={styles.tab}>
      <ArchiveTabLabel label={section.label} icon={SECTION_ICONS[section.key]} />
    </Link>)}
  </nav>;
}
