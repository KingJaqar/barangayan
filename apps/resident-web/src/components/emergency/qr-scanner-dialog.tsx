'use client';

import { evacuationCenterQrPayloadSchema, type EvacuationCenterQrPayload } from '@barangayan/shared';
import { CameraOff, Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useQrCheckins } from '@/hooks/use-qr-checkins';

type ScanState = 'starting' | 'scanning' | 'denied' | 'processing';

/**
 * Web port of qr-scanner-overlay.tsx + qr-permission-modal.tsx, merged into one dialog —
 * the browser's own permission prompt replaces the native app's pre-flight
 * `Camera.getCameraPermissionsAsync()` check (there's no JS API to query camera
 * permission state consistently across browsers ahead of `getUserMedia`), so this shows
 * a denied-state message reactively instead of pre-emptively. Validates the scanned
 * payload against evacuationCenterQrPayloadSchema before calling checkIn(), exactly like
 * the mobile version [C-011, C-012].
 */
export function QrScannerDialog({ open, onClose, userId, barangayId, userBarangayId }: { open: boolean; onClose: () => void; userId: string | null; barangayId: string | null; userBarangayId: string | null }) {
  const elementId = useId().replace(/[:]/g, '');
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [state, setState] = useState<ScanState>('starting');
  const { checkIn, updateHouseholdStatus } = useQrCheckins(userId, barangayId);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setState('starting');
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;
      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          (decodedText) => {
            if (!cancelled) handleDecoded(decodedText);
          },
          undefined,
        );
        if (!cancelled) setState('scanning');
      } catch {
        if (!cancelled) setState('denied');
      }
    }

    async function handleDecoded(raw: string) {
      const scanner = scannerRef.current;
      if (!scanner || !scanner.isScanning) return;
      setState('processing');
      try {
        scanner.pause(true);
      } catch {
        // already stopped
      }

      let payload: unknown;
      try {
        payload = JSON.parse(raw.trim());
      } catch {
        toast.error('This QR code does not contain a valid payload.');
        resumeScanning();
        return;
      }

      const parsed = evacuationCenterQrPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        toast.error('This QR code is not a valid evacuation center check-in code.');
        resumeScanning();
        return;
      }

      const qrData: EvacuationCenterQrPayload = parsed.data;
      if (qrData.barangay_id !== userBarangayId) {
        toast.error('This QR code belongs to a different barangay.');
        resumeScanning();
        return;
      }

      const result = await checkIn(qrData.center_id);
      if (result) {
        const householdUpdated = await updateHouseholdStatus();
        if (!householdUpdated) toast.warning('Check-in recorded, but could not update household status.');
        toast.success('Your presence has been registered at the evacuation center.');
        onClose();
      } else {
        toast.error('Could not record your check-in. Please try again.');
        resumeScanning();
      }
    }

    function resumeScanning() {
      setState('scanning');
      try {
        scannerRef.current?.resume();
      } catch {
        // ignore
      }
    }

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkIn/updateHouseholdStatus are stable per userId/barangayId, re-running on open is what we want
  }, [open, elementId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-4">
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-white">
          <X size={24} />
        </button>
        <p className="text-sm font-semibold text-white">Scan QR Code</p>
        <span className="w-10" />
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <div id={elementId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

        {state === 'denied' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-8 text-center">
            <CameraOff size={40} className="text-white/70" />
            <p className="text-sm text-white">Camera access was denied or unavailable.</p>
            <p className="text-xs text-white/60">Allow camera access in your browser&apos;s site settings, then try again — or use the upload option below.</p>
          </div>
        ) : state === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={32} className="animate-spin text-white" />
          </div>
        ) : (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-white/30" />
        )}
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pb-10 pt-4">
        <p className="text-center text-sm text-white/90">Position the barangay QR code within the frame</p>
        {state === 'processing' ? (
          <div className="flex items-center gap-2 text-white">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs font-semibold">Processing…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
