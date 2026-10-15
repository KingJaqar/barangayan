'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** Recovery for older requests that did not collect a page count at submission. */
export function RequestPageCount({ requestId, onSaved }: { requestId: string; onSaved: () => void }) {
  const [pages, setPages] = useState('1');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function save() {
    if (busy.current) return;
    const count = Number(pages);
    if (!Number.isInteger(count) || count < 1 || count > 1000000) { setError('Enter a whole page count between 1 and 1,000,000.'); return; }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const { error: failure } = await createSupabaseBrowserClient().rpc('set_service_request_pages', { p_request_id: requestId, p_total_pages: count });
      if (failure) throw failure;
      onSaved();
    } catch { setError('Could not save the page count. Refresh and try again.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h2 className="text-xl font-semibold">Payment Method</h2>
    <label className="block">Total pages across all copies
      <input className="block w-full rounded-lg border p-3" type="number" min={1} max={1000000} required value={pages} onChange={event => setPages(event.target.value)} disabled={pending} />
    </label>
    <p>₱10.00 per page. Total: ₱{(Number(pages || 0) * 10).toFixed(2)}</p>
    {error ? <p role="alert">{error}</p> : null}
    <Button type="submit" loading={pending}>Continue to payment methods</Button>
  </form>;
}
