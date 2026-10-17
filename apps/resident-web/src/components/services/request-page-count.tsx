'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { beginAttempt, notify } from '@/lib/notify';

/** Recovery for older requests that did not collect a page count at submission. */
export function RequestPageCount({ requestId, onSaved }: { requestId: string; onSaved: () => void }) {
  const [pages, setPages] = useState('1');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, [requestId]);
  async function save() {
    if (busy.current) return;
    const attempt = beginAttempt('request-pages');
    const count = Number(pages);
    if (!Number.isInteger(count) || count < 1 || count > 1000000) { setError('Enter a whole page count between 1 and 1,000,000.'); notify.error('Enter a whole page count between 1 and 1,000,000.', { id: attempt }); return; }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const { error: failure, status } = await createSupabaseBrowserClient().rpc('set_service_request_pages', { p_request_id: requestId, p_total_pages: count });
      if (failure) {
        const uncertain = status === 0 || status >= 500;
        const message = uncertain ? "We couldn't confirm the page count was saved. Refresh the request before trying again." : "Couldn't save the page count. Please try again.";
        notify[uncertain ? 'warning' : 'error'](message, { id: attempt });
        if (active.current) setError(message);
        return;
      }
      notify.success('Page count saved.', { id: attempt });
      if (active.current) onSaved();
    } catch {
      const message = "We couldn't confirm the page count was saved. Refresh the request before trying again.";
      notify.warning(message, { id: attempt });
      if (active.current) setError(message);
    }
    finally { busy.current = false; if (active.current) setPending(false); }
  }
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h2 className="text-xl font-semibold">Payment Method</h2>
    <label className="block">Total pages across all copies
      <input className="block w-full rounded-lg border p-3" type="number" min={1} max={1000000} required value={pages} onChange={event => setPages(event.target.value)} disabled={pending} />
    </label>
    <p>₱10.00 per page. Total: ₱{(Number(pages || 0) * 10).toFixed(2)}</p>
    {error ? <p>{error}</p> : null}
    <Button type="submit" loading={pending}>Continue to payment methods</Button>
  </form>;
}
