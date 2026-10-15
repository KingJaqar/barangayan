import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { browseTable } from '@/lib/admin-tables/queries/browse';
import { parseArchiveState } from '@/lib/admin-tables/archive-config';
import { RECORD_CONFIG } from '@/lib/admin-tables/record-config';
import { ARCHIVE_SECTIONS, contentArchiveConfig, type ContentArchiveSection } from '@/lib/admin-tables/archive-sections';
import { parseBrowseState } from '@/lib/admin-tables/browse-state';
import { browseContentArchive } from '@/lib/admin-tables/queries/content-archive';
import type { TableName } from '@/lib/admin-tables/table-configs';
import { ArchivedRecords } from './records';
import { ArchivedContentRecords } from './content-records';
import styles from '../archive.module.css';

export default async function Page({ params, searchParams }: {
  params: Promise<{ screen: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  const section = ARCHIVE_SECTIONS.find(item => item.key === screen);
  if (!section) notFound();
  const query = new URLSearchParams(Object.entries(await searchParams).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]]));
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');
  const { data: actor } = await db.from('profiles').select('role,deleted_at,barangay_id').eq('id', user.id).maybeSingle();
  if (actor?.role !== 'admin' || actor.deleted_at || !actor.barangay_id) redirect('/login');
  const back = <Link href={section.path} className="mb-4 inline-block text-sm text-[var(--accent)] underline">Back to {section.label}</Link>;
  if (Object.hasOwn(RECORD_CONFIG, screen)) {
    const name = screen as TableName;
    const state = parseArchiveState(name, query);
    const result = await browseTable(name, state, db, AbortSignal.timeout(15000), new Date(), true);
    return <div className={styles.records}>{back}<ArchivedRecords key={name} name={name} result={result} requestedState={state} currentUserId={user.id} /></div>;
  }
  const name = screen as ContentArchiveSection;
  const state = parseBrowseState(query, contentArchiveConfig(name));
  state.q = state.q.trim();
  const result = await browseContentArchive(name, state, db, actor.barangay_id);
  return <div className={styles.records}>{back}<ArchivedContentRecords key={name} name={name} label={section.label} result={result} requestedState={state} /></div>;
}
