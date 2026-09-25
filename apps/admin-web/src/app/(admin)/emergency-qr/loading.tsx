import { PageSkeleton } from '@/components/loading/page-skeleton';

export default function EmergencyQrLoading() {
  return <PageSkeleton variant="qr" label="Loading emergency QR" className="mx-auto max-w-4xl" />;
}
