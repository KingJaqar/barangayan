'use client';

import { evacuationCenterQrPayloadSchema, type EvacuationCenterQrPayload } from '@barangayan/shared';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { useQrCheckins } from '@/hooks/use-qr-checkins';

/**
 * New, desktop-only fallback for residents without (or unwilling to grant) a working
 * camera — decodes a QR code from an uploaded photo via html5-qrcode's scanFile(), same
 * validation/check-in path as the live scanner (qr-scanner-dialog.tsx). No mobile
 * equivalent — a genuinely new component per the plan's file tree.
 */
export function QrUploadFallback({ userId, barangayId, userBarangayId }: { userId: string | null; barangayId: string | null; userBarangayId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { checkIn, updateHouseholdStatus } = useQrCheckins(userId, barangayId);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-upload-fallback-hidden');
      let decoded: string;
      try {
        decoded = await scanner.scanFile(file, false);
      } catch {
        toast.error('No QR code found in that image.');
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(decoded.trim());
      } catch {
        toast.error('This QR code does not contain a valid payload.');
        return;
      }

      const parsed = evacuationCenterQrPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        toast.error('This QR code is not a valid evacuation center check-in code.');
        return;
      }

      const qrData: EvacuationCenterQrPayload = parsed.data;
      if (qrData.barangay_id !== userBarangayId) {
        toast.error('This QR code belongs to a different barangay.');
        return;
      }

      const result = await checkIn(qrData.center_id);
      if (result) {
        const householdUpdated = await updateHouseholdStatus();
        if (!householdUpdated) toast.warning('Check-in recorded, but could not update household status.');
        toast.success('Your presence has been registered at the evacuation center.');
      } else {
        toast.error('Could not record your check-in. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-center">
      <div id="qr-upload-fallback-hidden" className="hidden" />
      <p className="text-xs text-muted-foreground">No working camera? Upload a photo of the QR code instead.</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
        <Upload size={14} />
        {busy ? 'Reading…' : 'Upload QR Image'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
