import { DocumentsList } from '@/components/services/documents-list';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Document catalog — guest-accessible (0005 migration's anon read policy on
 * document_types, confirmed against the migration directly rather than assumed per the
 * plan's No-Guessing Rule: `create policy "anyone can read active document types" ...
 * to anon using (is_active = true)`). Mirrors mobile's DocumentsList segment.
 *
 * The catalog itself stays a Server Component fetch; DocumentsList (client) owns the
 * grid + the DocumentRequestModal it opens on click — clicking a card no longer
 * navigates to /services/[documentId], it slides the whole request-to-payment flow in
 * from the right instead. `isAuthenticated` decides whether that panel's CTA reads
 * "Request This Document" or "Log In to Request", same branch the old detail page used.
 */
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const { user } = await getOptionalUser();

  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, name, description, fee_centavos, processing_target_hours')
    .eq('is_active', true)
    .order('name');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Document Catalog</h1>
        <p className="text-sm text-muted-foreground">Browse the documents your barangay can issue, and what each one requires.</p>
      </div>

      <DocumentsList documentTypes={documentTypes ?? []} isAuthenticated={user !== null} />
    </div>
  );
}
