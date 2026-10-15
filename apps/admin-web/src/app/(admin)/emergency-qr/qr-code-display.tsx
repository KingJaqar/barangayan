'use client';

import { useRef, useState } from 'react';
import { Check, Copy, Download, MapPin, Save, ScanLine } from 'lucide-react';
import styles from './emergency-qr.module.css';
import { QRCodeCanvas } from 'qrcode.react';
import { logAdminAction } from '@/actions/admin-audit-actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import type { Json, Tables } from '@barangayan/shared';

type EvacuationCenter = Tables<'evacuation_centers'>;

export function QrCodeDisplay({
  center,
  payload,
}: {
  center: EvacuationCenter;
  payload: Json;
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
      // No barangay_id column here — the row is scoped to a barangay through its
      // evacuation center (see migration 0050).
      .upsert({ evacuation_center_id: center.id, qr_payload: payload }, {
        onConflict: 'evacuation_center_id',
      });
    if (error) {
      toast.showError(`Failed to save: ${error.message}`);
      return;
    }

    // The QR row's own id isn't returned by this upsert; evacuationCenterId is metadata,
    // not entityId — that field belongs to the evacuation center, not this QR row.
    logAdminAction({
      action: 'update',
      entityType: 'emergency_qr',
      entityLabel: center.name,
      metadata: { evacuationCenterId: center.id },
    }).catch(() => {});

    toast.showSuccess('QR code saved to database.');
    router.refresh();
  }

  return (
    <article className={styles.qrWorkspace}>
      <div className={styles.qrStage}>
        <p className={styles.eyebrow}><ScanLine size={15} aria-hidden="true" /> Scan to check in</p>
        <div className={styles.qrPaper}>
          <QRCodeCanvas ref={canvasRef} value={JSON.stringify(payload)} size={600} level="H" includeMargin
            title={`Check-in QR code for ${center.name}`} />
        </div>
        <p className={styles.scanCaption}>Scan with the Barangayan mobile app to check in.</p>
      </div>
      <div className={styles.qrDetails}>
        <div>
          <p className={styles.eyebrow}>Evacuation center</p>
          <h3 className={styles.centerName}>{center.name}</h3>
          <p className={styles.address}><MapPin size={15} aria-hidden="true" /> {center.address ?? 'No address'}</p>
        </div>
        <p className={styles.qrHelp}>Save this code for your center, or download a PNG to print and display at the check-in area.</p>
        <div className={styles.qrActions}>
          <button onClick={saveToDb} className={`${styles.button} ${styles.primary}`}>
            <Save size={16} aria-hidden="true" /> Save QR code
          </button>
          <button onClick={downloadPng} className={styles.button}>
            <Download size={16} aria-hidden="true" /> Download PNG
          </button>
        </div>
        <details className={styles.payload}>
          <summary>QR payload <span className={styles.muted}>Technical details</span></summary>
          <pre>{JSON.stringify(payload, null, 2)}</pre>
          <button onClick={copyPayload} className={styles.editButton}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? 'Copied!' : 'Copy Payload'}
          </button>
        </details>
      </div>
    </article>
  );
}
