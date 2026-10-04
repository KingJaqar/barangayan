'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function ProfileSetupNotice() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <aside role="status" className="flex flex-wrap items-center gap-3 border-b bg-card p-4 text-sm">
    <p>Your account details could not be saved yet. You can still browse information. Retry account setup before using resident services.</p>
    <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? 'Retrying…' : 'Retry account setup'}
    </Button>
  </aside>;
}
