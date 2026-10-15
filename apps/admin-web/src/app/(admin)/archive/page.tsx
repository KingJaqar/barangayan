import { redirect } from 'next/navigation';
import { archiveHref } from '@/lib/admin-tables/archive-sections';

export default function ArchivesPage() {
  redirect(archiveHref('services'));
}
