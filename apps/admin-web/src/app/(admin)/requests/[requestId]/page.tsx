import { redirect } from 'next/navigation';
import { requestRecordHref } from '@/lib/request-record-link';

// Compatibility for saved links; request details now live only in the side sheet.
export default async function LegacyRequestRedirect({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  redirect(requestRecordHref(requestId));
}
