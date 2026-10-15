import styles from '@/components/admin/content-workspace.module.css';
import { ContentCreatePanel } from '@/components/admin/content-create-panel';
import { RecordArchiveLink } from '@/components/admin/record-archive-link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

import { DocumentTypeCatalog } from './document-type-catalog';
import { DocumentTypeForm } from './document-type-form';

// Admin CRUD for document_types — previously "no client insert/update/delete policy"
// per the 0002 migration's comment; this is that deferred admin UI, now unlocked by the
// 0007 migration's "admins can manage document types in their barangay" RLS policy.
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('barangay_id').eq('id', user.id).single();
  const { data: documentTypes, error: catalogError } = await supabase
    .from('document_types')
    .select('*')
    .is('deleted_at', null)
    .order('name');

  if (profileError || !profile?.barangay_id || catalogError) return <div className={styles.page}>
    <h1 className="text-2xl font-bold">Services</h1>
    <p role="alert" className="my-4 text-sm text-red-600">Unable to load the document catalog. Check your connection and try again.</p>
    <a href="/services" className="text-sm underline">Retry</a>
  </div>;

  return (
    <div className={styles.page}>
      <ContentCreatePanel
        title="Services"
        description="Manage the barangay’s document request catalog and fees."
        forms={[
          { label: "Create new service", title: "New service",
            description: "Define the service details, Citizen’s Charter, requirements, and pricing.",
            content: <DocumentTypeForm barangayId={profile?.barangay_id ?? ''} /> },
        ]}
      />

      <RecordArchiveLink name="services" />
      <DocumentTypeCatalog documentTypes={documentTypes ?? []} />
    </div>
  );
}
