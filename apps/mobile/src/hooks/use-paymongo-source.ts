import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type PaymentStatus = 'idle' | 'loading' | 'pending' | 'paid' | 'expired' | 'error';

export interface PaymongoSource {
  sourceId: string;
  qrImageUrl: string;
  expiresAt: number;
}

const POLL_INTERVAL_MS = 5000;
const EXPIRY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h, matches the QR Ph source's own lifetime

/**
 * Creates a PayMongo QR Ph source for a service request (via the create-payment-source
 * Edge Function, which holds the secret key — never in this app) and polls for its
 * status until 'chargeable'/'paid' or 'expired'. Only ever mounted from
 * payment/qrph/[requestId].tsx, which is itself unreachable from the UI until
 * PAYMENT_SETTLEMENT_READY is true — see constants/payment.ts.
 */
export function usePaymongoSource(requestId: string, amountCentavos: number, description: string) {
  const [source, setSource] = useState<PaymongoSource | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    supabase.functions
      .invoke('create-payment-source', {
        body: { requestId, amountCentavos, description },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.data?.id) {
          setStatus('error');
          return;
        }
        const attrs = data.data.attributes;
        setSource({
          sourceId: data.data.id as string,
          qrImageUrl: (attrs?.qr_image ?? attrs?.redirect?.checkout_url) as string,
          expiresAt: Date.now() + EXPIRY_WINDOW_MS,
        });
        setStatus('pending');
      });

    return () => {
      cancelled = true;
    };
  }, [requestId, amountCentavos, description]);

  useEffect(() => {
    if (!source || status !== 'pending') return;

    pollingRef.current = setInterval(async () => {
      const { data } = await supabase.functions.invoke('check-payment-status', {
        body: { sourceId: source.sourceId },
      });

      if (data?.status === 'chargeable' || data?.status === 'paid') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatus('paid');
      } else if (data?.status === 'expired') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatus('expired');
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [source, status]);

  return { source, status };
}
