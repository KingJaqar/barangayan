import { createSupabaseServerClient } from '@/lib/supabase/server';

import { DocumentTypeForm } from './document-type-form';
import { DocumentTypeRow } from './document-type-row';

// Admin CRUD for document_types — previously "no client insert/update/delete policy"
// per the 0002 migration's comment; this is that deferred admin UI, now unlocked by the
// 0007 migration's "admins can manage document types in their barangay" RLS policy.
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();
  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('*')
    .is('deleted_at', null)
    .order('name');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Types</h1>
          <p className="text-sm text-zinc-500">Manage the barangay&apos;s document request catalog.</p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">New Document Type</h2>
        <DocumentTypeForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Existing Document Types</h2>
      <div className="flex flex-col gap-3">
        {(documentTypes ?? []).map((doc) => (
          <DocumentTypeRow key={doc.id} documentType={doc} />
        ))}
        {(documentTypes ?? []).length === 0 ? (
          <p className="text-center text-sm text-zinc-500">No document types yet — add one above.</p>
        ) : null}
      </div>
    </div>
  );
}
