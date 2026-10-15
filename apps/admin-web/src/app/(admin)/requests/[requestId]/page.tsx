import { notFound } from 'next/navigation';
import { loadRequestReview } from '@/actions/request-review-actions';
import { RequestReview } from '@/components/admin/request-review';

export default async function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const data = await loadRequestReview(requestId);
  if (!data) notFound();
  return <RequestReview data={data} />;
}
