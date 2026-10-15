'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';
import { archiveHref, type ArchiveSection } from '@/lib/admin-tables/archive-sections';

export function RecordArchiveLink({ name, beforeOpen }: { name: ArchiveSection; beforeOpen?: () => Promise<boolean> }) {
  const router = useRouter();
  return <Link href={archiveHref(name)}
    className="mb-4 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-[var(--accent)] dark:border-zinc-700 dark:hover:bg-zinc-800"
    onClick={event => {
      if (!beforeOpen || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      void beforeOpen().then(ok => { if (ok) router.push(archiveHref(name)); });
    }}><Archive size={15} aria-hidden="true" />Browse archived records</Link>;
}
