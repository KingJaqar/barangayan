import type { ReactNode } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ArchiveTabs } from './archive-tabs';

export default function ArchiveLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-w-0 max-w-6xl">
    <AdminPageHeader title="Archives" description="Find archived records across all sections of your barangay." />
    <ArchiveTabs />
    {children}
  </div>;
}
