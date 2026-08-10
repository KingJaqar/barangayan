'use client';

import { useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { QrCodeDisplay } from './qr-code-display';
import type { Json, Tables } from '@barangayan/shared';

type EvacuationCenter = Tables<'evacuation_centers'>;

export function QrCodesTab({
  initialCenters,
  barangayId,
}: {
  initialCenters: EvacuationCenter[];
  barangayId: string;
}) {
  const [selectedCenterId, setSelectedCenterId] = useState<string>(initialCenters[0]?.id ?? '');
  const router = useRouter();
  const toast = useToast();

  const selectedCenter = initialCenters.find((c) => c.id === selectedCenterId);

  const payload = useMemo(() => {
    if (!selectedCenter) return null;
    const p = {
      type: 'EVACUATION_CENTER_CHECKIN',
      version: '1.0',
      center_id: selectedCenter.id,
      center_name: selectedCenter.name,
      barangay_id: selectedCenter.barangay_id,
      generated_at: new Date().toISOString(),
    };
    return p as Json;
  }, [selectedCenter]);

  async function regenerateAll() {
    const supabase = createSupabaseBrowserClient();
    for (const center of initialCenters) {
      const p = {
        type: 'EVACUATION_CENTER_CHECKIN',
        version: '1.0',
        center_id: center.id,
        center_name: center.name,
        barangay_id: center.barangay_id,
        generated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('evacuation_center_qr_codes')
        .upsert({ evacuation_center_id: center.id, qr_payload: p as Json, barangay_id: barangayId } as any, {
          onConflict: 'evacuation_center_id',
        });
      if (error) {
        toast.showError(`Failed to generate QR for ${center.name}: ${error.message}`);
        return;
      }
    }
    toast.showSuccess('QR codes regenerated for all centers.');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Select Center</label>
          <select
            value={selectedCenterId}
            onChange={(e) => setSelectedCenterId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800">
            {initialCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={regenerateAll}
          className="rounded-full bg-[#0F6E5B] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Regenerate All
        </button>
      </div>

      {selectedCenter && payload && (
        <QrCodeDisplay center={selectedCenter} payload={payload} barangayId={barangayId} />
      )}

      {initialCenters.length === 0 && (
        <p className="text-center text-sm text-zinc-500">No evacuation centers configured.</p>
      )}
    </div>
  );
}
