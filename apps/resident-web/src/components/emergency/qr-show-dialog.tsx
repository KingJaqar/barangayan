'use client';

import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';
import { Download, MapPin, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EvacuationCenterWithDistance } from '@/hooks/use-evacuation-centers';

/**
 * Web port of qr-show-modal.tsx — lets a resident pick an evacuation center and display
 * its check-in QR code to on-site staff. Ported as-is from mobile's existing, shipped
 * behavior; see qr-scanner-dialog.tsx's sibling doc comment for the same payload shape
 * [C-012]. Download uses the underlying <canvas> directly (QRCodeCanvas) instead of
 * react-native-view-shot, which has no web equivalent.
 */
export function QrShowDialog({ open, onClose, centers, barangayId }: { open: boolean; onClose: () => void; centers: EvacuationCenterWithDistance[]; barangayId: string | null }) {
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
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
    const canvas = canvasWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `evacuation-center-qr-${selectedCenter?.name.replace(/\s+/g, '-').toLowerCase() ?? 'code'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function handleShare() {
    if (!qrValue) return;
    const shareText = `Evacuation Center Check-in QR\n\n${qrValue}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Evacuation Center QR Code', text: shareText });
      } catch {
        // user cancelled — no-op
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success('Copied to clipboard.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Show QR Code</DialogTitle>
          <DialogDescription>Show this screen to center staff so they can scan it at the desk.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <select
            value={selectedCenterId ?? ''}
            onChange={(e) => setSelectedCenterId(e.target.value)}
            className="h-11 rounded-lg border border-input bg-transparent px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">
            {centers.length === 0 ? <option value="">No evacuation centers found</option> : null}
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

          <div ref={canvasWrapperRef} className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl border border-border bg-white p-3">
            {!selectedCenter ? (
              <p className="text-center text-xs text-muted-foreground">Select a center to generate a QR code</p>
            ) : !qrValue ? (
              <p className="text-center text-xs text-muted-foreground">Unable to generate QR code</p>
            ) : (
              <QRCodeCanvas value={qrValue} size={220} bgColor="#FFFFFF" fgColor="#000000" level="M" />
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={!qrValue} onClick={handleShare}>
              <Share2 size={16} /> Share
            </Button>
            <Button type="button" variant="outline" className="flex-1" disabled={!qrValue} onClick={handleDownload}>
              <Download size={16} /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
