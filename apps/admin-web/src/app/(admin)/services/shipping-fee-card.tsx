'use client';

import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

/** Flat, per-barangay shipping/delivery fee — lives as its own column on barangays
 * (not the Settings page's config jsonb blob, see migration 0064), added to every
 * request's document fee for both QR Ph and Cash on Delivery (every request is
 * delivered — out_for_delivery is not optional). Lives on the Services page since it's
 * a payment/document-catalog concern, alongside the fees this adds onto. */
export function ShippingFeeCard({ barangayId }: { barangayId: string }) {
  const toast = useToast();
  const [pesos, setPesos] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('barangays')
      .select('shipping_fee_centavos')
      .eq('id', barangayId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setPesos((((data?.shipping_fee_centavos as number) ?? 0) / 100).toFixed(2));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [barangayId]);

  async function handleSave() {
    const value = Number(pesos);
    if (Number.isNaN(value) || value < 0) {
      toast.showError('Enter a valid, non-negative shipping fee.');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('barangays')
      .update({ shipping_fee_centavos: Math.round(value * 100) })
      .eq('id', barangayId);
    setSaving(false);

    if (error) {
      toast.showError(`Failed to save shipping fee: ${error.message}`);
      return;
    }
    toast.showSuccess('Shipping fee saved.');
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Shipping Fee</h2>
        <p className="mt-0.5 max-w-md text-xs text-zinc-500">
          Flat delivery fee added to every request&apos;s document fee (QR Ph &amp; Cash on Delivery). Defaults to
          ₱0.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Fee (₱)</span>
          <input
            className={`${inputClass} w-28`}
            type="number"
            min="0"
            step="0.01"
            disabled={loading}
            value={pesos}
            onChange={(e) => setPesos(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
