import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

import { RequestTracking } from './request-tracking';

/**
 * Migrated + extended from apps/admin-web/src/app/resident/requests/[requestId]/page.tsx
 * — this thin Server Component only gates + fetches the initial row (so the page has
 * real content on first paint / for crawlers), then hands off to a Client Component for
 * the progress bar, pending-QR countdown, realtime subscription, and cancel actions the
 * plan calls for (all of which need to run in the browser, same as mobile's
 * requests/[requestId].tsx this is ported from).
 */
export default async function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: request } = await supabase
    .from('service_requests')
    .select('*, document_types(name, processing_target_hours, fee_centavos)')
    .eq('id', requestId)
    .eq('resident_id', user.id)
    .single();

  if (!request) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RequestTracking requestId={requestId} initialRequest={request} />
    </div>
  );
}
