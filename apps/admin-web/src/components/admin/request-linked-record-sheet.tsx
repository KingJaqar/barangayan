'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { RecordSheet } from './record-workspace';

const subscribe = () => () => {};

/** Links can target records outside the current table page or status filter. */
export function RequestLinkedRecordSheet({ onChanged }: { onChanged: () => void }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  // RecordSheet uses a portal; wait for hydration before accessing the document.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const id = params.get('record');
  if (!mounted || !id) return null;
  return <RecordSheet key={id} name="requests" id={id} onChanged={onChanged} onClose={() => {
    const next = new URLSearchParams(params.toString());
    next.delete('record');
    router.replace(pathname + (next.size ? `?${next}` : ''), { scroll: false });
  }} />;
}
