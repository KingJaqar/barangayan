'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import type { Json, Tables } from '@barangayan/shared';

type EvacuationCenter = Tables<'evacuation_centers'>;

export function QrCodeDisplay({
  center,
  payload,
  barangayId,
}: {
  center: EvacuationCenter;
  payload: Json;
  barangayId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${center.name.replace(/\s+/g, '_')}_qr.png`;
    link.href = url;
    link.click();
  }

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      toast.showSuccess('Payload copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.showError('Failed to copy payload.');
    }
  }

  async function saveToDb() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('evacuation_center_qr_codes')
      .upsert({ evacuation_center_id: center.id, qr_payload: payload, barangay_id: barangayId } as any, {
        onConflict: 'evacuation_center_id',
      });
    if (error) {
      toast.showError(`Failed to save: ${error.message}`);
      return;
    }
    toast.showSuccess('QR code saved to database.');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{center.name}</h3>
          <p className="text-xs text-zinc-500">{center.address ?? 'No address'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveToDb}
            className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
            Save to DB
          </button>
          <button
            onClick={downloadPng}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Download PNG
          </button>
          <button
            onClick={copyPayload}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            {copied ? 'Copied!' : 'Copy Payload'}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800">
          <QRCodeCanvas
            ref={canvasRef}
            value={JSON.stringify(payload)}
            size={600}
            level="H"
            includeMargin
          />
        </div>
        <p className="text-xs text-zinc-400">Scan with the Barangayan mobile app to check in.</p>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payload</p>
        <pre className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 overflow-x-auto dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}
