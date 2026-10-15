import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SEARCH_CATEGORIES, normalizeQuery, searchFilter, searchPage, searchUrl } from '@/lib/search/model';
import { authorizeSearch, readSearchRecord, SearchAccessError } from '@/lib/search/server';
import { CategoryIcon } from '@/components/admin/search/search-hit';
import styles from '@/components/admin/search/search.module.css';

const LABELS: Record<string, string> = { 'profiles.full_name': 'Resident', 'profile.email': 'Email', 'profile.mobile_number': 'Mobile number',
  'service_requests.reference_number': 'Request number', 'service_requests.profiles.full_name': 'Resident', 'medical_drives.title': 'Health drive',
  'incident_categories.name': 'Incident category', 'document_types.name': 'Document', fee_centavos: 'Fee', amount_centavos: 'Amount',
  id_verification_status: 'ID verification', is_active: 'Active', day_of_week: 'Collection day', 'waste_zones.name': 'Waste zone' };
function formatValue(key: string, value: string) {
  if (key.endsWith('_centavos')) return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) / 100);
  if (key === 'day_of_week') return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(value)] ?? value;
  if (key.endsWith('_at') && !Number.isNaN(Date.parse(value))) return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
  return ['status', 'method', 'category', 'type', 'official_role', 'relation', 'role', 'email_verification_status', 'id_verification_status', 'facilities'].includes(key)
    ? value.replaceAll('_', ' ') : value;
}
export default async function SearchRecordPage({ params, searchParams }: {
  params: Promise<{ category: string; recordId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const route = await params;
  const category = searchFilter(route.category);
  if (category === 'all' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(route.recordId)) notFound();
  if (category === 'requests') redirect(`/requests/${route.recordId}`);
  const db = await createSupabaseServerClient();
  let record;
  try { record = await readSearchRecord(db, await authorizeSearch(db), category, route.recordId); }
  catch (error) { if (error instanceof SearchAccessError) redirect('/login'); throw error; }
  if (!record) notFound();
  const config = SEARCH_CATEGORIES.find(item => item.id === category)!;
  const returnParams = await searchParams;
  const queryParam = returnParams.q;
  const query = normalizeQuery(typeof queryParam === 'string' ? queryParam : '');
  const returnCategory = searchFilter(typeof returnParams.returnCategory === 'string' ? returnParams.returnCategory : null);
  const returnPage = searchPage(typeof returnParams.returnPage === 'string' ? returnParams.returnPage : null);
  return <article className={`${styles.page} ${styles.detail}`}>
    <Link href={searchUrl(query, returnCategory, returnPage)} className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> Back to search results</Link>
    <div className={styles.detailHeading}><CategoryIcon category={category} /><div><p className={styles.eyebrow}>{config.label}</p><h1>{record.hit.title}</h1><p>{record.hit.meta}</p></div></div>
    <dl className={styles.detailFields}>{record.fields.map(field => <div key={field.key}>
      <dt>{LABELS[field.key] ?? field.key.replaceAll('_', ' ')}</dt><dd>{formatValue(field.key, field.value)}</dd>
    </div>)}</dl>
    <Link className={styles.manage} href={config.path}>Open {config.label.toLowerCase()} workspace <ArrowUpRight size={17} aria-hidden="true" /></Link>
  </article>;
}
