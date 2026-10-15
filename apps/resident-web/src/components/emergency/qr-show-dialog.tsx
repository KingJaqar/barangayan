'use client';

import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';
import { Download, MapPin, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import { InlineReadError } from '@/components/shared/inline-read-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EvacuationCenterWithDistance } from '@/hooks/use-evacuation-centers';
import { beginAttempt, notify } from '@/lib/notify';
import styles from './emergency.module.css';

/**
 * Web port of qr-show-modal.tsx — lets a resident pick an evacuation center and display
 * its check-in QR code to on-site staff. Ported as-is from mobile's existing, shipped
 * behavior; see qr-scanner-dialog.tsx's sibling doc comment for the same payload shape
 * [C-012]. Download uses the underlying <canvas> directly (QRCodeCanvas) instead of
 * react-native-view-shot, which has no web equivalent.
 */
export function QrShowDialog({
  open,
  onClose,
  centers,
  barangayId,
  centersStatus = 'ready',
  onRetryCenters,
}: {
  open: boolean;
  onClose: () => void;
  centers: EvacuationCenterWithDistance[];
  barangayId: string | null;
  /** State of the centers read behind `centers`, so a failed or pending read is never
   * shown as "No evacuation centers found". */
  centersStatus?: 'loading' | 'error' | 'ready';
  onRetryCenters?: () => void;
}) {
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && centers.length > 0 && !selectedCenterId) {
      // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
      // react-hooks/set-state-in-effect.
      Promise.resolve().then(() => setSelectedCenterId(centers[0].id));
    }
  }, [open, centers, selectedCenterId]);

  const selectedCenter = centers.find((c) => c.id === selectedCenterId) ?? null;

  const qrPayload = selectedCenter
    ? {
        type: 'EVACUATION_CENTER_CHECKIN' as const,
        version: '1.0' as const,
        center_id: selectedCenter.id,
        center_name: selectedCenter.name,
        barangay_id: barangayId ?? '',
        generated_at: new Date().toISOString(),
      }
    : null;

  const parsed = qrPayload ? evacuationCenterQrPayloadSchema.safeParse(qrPayload) : null;
  const qrValue = parsed?.success ? JSON.stringify(parsed.data) : '';

  function handleDownload() {
    const attempt = beginAttempt('qr-download');
    const canvas = canvasWrapperRef.current?.querySelector('canvas');
    if (!canvas) {
      notify.error("Couldn't prepare the QR image.", { id: attempt, description: 'Close this window and open it again.' });
      return;
    }
    try {
      const link = document.createElement('a');
      link.download = `evacuation-center-qr-${selectedCenter?.name.replace(/\s+/g, '-').toLowerCase() ?? 'code'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      // The browser starts the download; whether it was saved is up to the browser.
      notify.success('Download started.', { id: attempt });
    } catch {
      notify.error("Couldn't download the QR image.", { id: attempt, description: 'You can show this screen to center staff instead.' });
    }
  }

  async function handleShare() {
    if (!qrValue || sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    const attempt = beginAttempt('qr-share');
    const shareText = `Evacuation Center Check-in QR

${qrValue}`;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Evacuation Center QR Code', text: shareText });
          return; // the system share sheet reports its own result
        } catch (thrown) {
          // The resident dismissed the share sheet: nothing to report.
          if (thrown instanceof DOMException && thrown.name === 'AbortError') return;
          // Sharing is unavailable here; fall back to copying.
        }
      }
      try {
        await navigator.clipboard.writeText(shareText);
        notify.success('Copied to clipboard.', { id: attempt });
      } catch {
        notify.error("Couldn't copy to the clipboard.", {
          id: attempt,
          description: 'Your browser blocked clipboard access. Use Download, or show this screen to center staff.',
        });
      }
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={`${styles.dialog} ${styles.qrDialog}`}>
        <DialogHeader>
          <DialogTitle>Show QR Code</DialogTitle>
          <DialogDescription>Show this screen to center staff so they can scan it at the desk.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {centersStatus === 'error' && centers.length === 0 && onRetryCenters ? (
            <InlineReadError message="We couldn't load the evacuation centers." onRetry={onRetryCenters} />
          ) : null}

          <select
            aria-label="Evacuation center"
            disabled={centers.length === 0}
            value={selectedCenterId ?? ''}
            onChange={(e) => setSelectedCenterId(e.target.value)}
            className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 [&>option]:bg-card [&>option]:text-foreground">
            {centers.length === 0 ? (
              <option value="">{centersStatus === 'loading' ? 'Loading evacuation centers…' : centersStatus === 'error' ? 'Evacuation centers unavailable' : 'No evacuation centers found'}</option>
            ) : null}
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {selectedCenter?.address ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={13} /> {selectedCenter.address}
            </p>
          ) : null}

          <div ref={canvasWrapperRef} className={styles.qrFrame}>
            {!selectedCenter ? (
              <p className="text-center text-xs text-muted-foreground">
                {centersStatus === 'loading' ? 'Loading evacuation centers…' : centersStatus === 'error' ? 'Evacuation centers could not be loaded' : 'Select a center to generate a QR code'}
              </p>
            ) : !qrValue ? (
              <p className="text-center text-xs text-muted-foreground">Unable to generate QR code</p>
            ) : (
              <QRCodeCanvas value={qrValue} size={220} level="M" />
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className={`${styles.secondaryButton} flex-1`} disabled={!qrValue} loading={sharing} loadingLabel="Sharing…" onClick={handleShare}>
              <Share2 size={16} /> Share
            </Button>
            <Button type="button" variant="outline" className={`${styles.secondaryButton} flex-1`} disabled={!qrValue} onClick={handleDownload}>
              <Download size={16} /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
