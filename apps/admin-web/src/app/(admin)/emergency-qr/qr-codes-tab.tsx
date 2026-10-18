'use client';

import { RefreshCw, QrCode } from 'lucide-react';
import styles from './emergency-qr.module.css';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import { useMemo, useState } from 'react';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { QrCodeDisplay } from './qr-code-display';
import type { Json, Tables } from '@barangayan/shared';

type EvacuationCenter = Tables<'evacuation_centers'>;

export function QrCodesTab({ initialCenters }: { initialCenters: EvacuationCenter[] }) {
  const [selectedCenterId, setSelectedCenterId] = useState<string>(initialCenters[0]?.id ?? '');
  const router = useRouter();

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
    const toastAttempt = beginAttempt('regenerateAll');
    try {
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
          // No barangay_id column here — the row is scoped to a barangay through its
          // evacuation center (see migration 0050).
          .upsert({ evacuation_center_id: center.id, qr_payload: p as Json }, {
            onConflict: 'evacuation_center_id',
          });
        if (error) {
          toast.error(`Failed to generate QR for ${center.name}: ${error.message}`, { id: toastAttempt });
          return;
        }
      }

      logAdminAction({
        action: 'update',
        entityType: 'emergency_qr',
        entityLabel: 'All evacuation center QR codes',
        metadata: { centerCount: initialCenters.length },
      }).catch(() => {});

      toast.success('QR codes regenerated for all centers.', { id: toastAttempt });
      router.refresh();

    } catch {
      toast.warning('The action could not be confirmed. Refresh the record before trying again.', { id: toastAttempt });
    }
  }

  return (
    <div className={styles.codesView}>
      <div className={styles.codesHeading}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>02 / Center check-in</p>
          <h2>One scan. A warmer welcome.</h2>
          <p>Select a center to save or download its check-in code.</p>
        </div>
        {initialCenters.length > 0 && <button onClick={regenerateAll} className={styles.button}>
          <RefreshCw size={15} aria-hidden="true" /> Regenerate All
        </button>}
      </div>

      {initialCenters.length > 0 && <div className={styles.centerPicker}>
        <label htmlFor="emergency-center" className={styles.eyebrow}>Evacuation center</label>
        <AdminSelect kind="center" id="emergency-center" aria-label="Select Center"
          value={selectedCenterId} onValueChange={(nextValue) => setSelectedCenterId(nextValue)}>
          {initialCenters.map((center) => (
            <option key={center.id} value={center.id}>{center.name}</option>
          ))}
        </AdminSelect>
        <span className={styles.muted}>{initialCenters.length} active {initialCenters.length === 1 ? 'center' : 'centers'}</span>
      </div>}

      {selectedCenter && payload && <QrCodeDisplay center={selectedCenter} payload={payload} />}
      {initialCenters.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.iconTile}><QrCode size={26} aria-hidden="true" /></span>
          <h3>No evacuation centers yet</h3>
          <p>QR codes will be available here once an active evacuation center is configured.</p>
        </div>
      )}
    </div>
  );
}
