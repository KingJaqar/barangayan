'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export function PickupChoice({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  async function choose() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const client = createSupabaseBrowserClient();
      const { error } = await client.rpc('set_service_request_payment_method', {
        p_request_id: requestId,
        p_method: 'pickup',
      });
      if (error) throw error;
      const result = await client.rpc('start_pickup_payment', { p_request_id: requestId });
      if (result.error) throw result.error;
      setMessage('Pickup payment recorded. Pay at the Barangay Hall when your document is ready.');
      router.refresh();
    } catch (error) {
      setMessage((error as { message: string }).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-6 space-y-3">
      <button
        className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-white"
        disabled={busy}
        onClick={() => void choose()}
      >
        {busy ? 'Recording…' : 'Pay at Pickup'}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
