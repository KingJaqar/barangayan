'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useServerReadRetry } from '@/components/shared/read-failure';

export function ProfileSetupNotice({ resultId }: { resultId: string }) {
  const router = useRouter();
  const { pending, errorAnnounced, retry } = useServerReadRetry(resultId, 'your account details');
  return <aside role={errorAnnounced ? undefined : 'status'} className="flex flex-wrap items-center gap-3 border-b bg-card p-4 text-sm">
    <p>Your account details could not be saved yet. You can still browse information. Retry account setup before using resident services.</p>
    <Button size="sm" variant="outline" disabled={pending} onClick={() => retry(() => router.refresh())}>
      {pending ? 'Retrying…' : 'Retry account setup'}
    </Button>
  </aside>;
}
