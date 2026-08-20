import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { NewRequestForm } from './new-request-form';

/**
 * Migrated from apps/admin-web/src/app/resident/requests/new/page.tsx, made dynamic per
 * a specific document type (mobile's services/request/[documentId].tsx flow — reached
 * from the Document Detail page's "Request This Document" button, not a bare catalog
 * picker like admin-web's original single-page version).
 */
export default async function NewRequestPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: doc }, { data: profile }] = await Promise.all([
    supabase.from('document_types').select('*').eq('id', documentId).eq('is_active', true).single(),
    supabase.from('profiles').select('full_name, mobile_number').eq('id', user.id).single(),
  ]);

  if (!doc) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Request a Document</h1>
        <p className="text-sm text-muted-foreground">Confirm your details and add any notes for the barangay staff.</p>
      </div>

      <NewRequestForm doc={doc} residentName={profile?.full_name ?? null} residentMobile={profile?.mobile_number ?? null} />
    </div>
  );
}
