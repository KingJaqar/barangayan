'use client';

import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Spinner } from '@/components/ui/loading';
import { useQrCheckins } from '@/hooks/use-qr-checkins';
import { beginAttempt, notify } from '@/lib/notify';
import { completeCheckIn, parseCenterQr } from '@/lib/qr-checkin';

type Stage = 'reading' | 'checking-in';

/**
 * New, desktop-only fallback for residents without (or unwilling to grant) a working
 * camera — decodes a QR code from an uploaded photo via html5-qrcode's scanFile(), same
 * validation/check-in path as the live scanner (qr-scanner-dialog.tsx, shared through
 * lib/qr-checkin.ts). No mobile equivalent — a genuinely new component per the plan's
 * file tree.
 *
 * Feedback plan RW-LT-05: one image at a time (a synchronous guard covers repeated
 * activation), real stage labels (reading the image, then recording the check-in), every
 * failure ends in one explanatory notification, and the file input is reset so the same
 * photo can be chosen again after a failure.
 */
export function QrUploadFallback({ userId, barangayId, userBarangayId }: { userId: string | null; barangayId: string | null; userBarangayId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [stage, setStage] = useState<Stage | null>(null);
  const { checkIn, updateHouseholdStatus, lastCheckInFailure } = useQrCheckins(userId, barangayId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleFile(file: File) {
    if (busyRef.current) return;
    busyRef.current = true;
    setStage('reading');
    const attempt = beginAttempt('qr-upload');
    try {
      let decoded: string;
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('qr-upload-fallback-hidden');
        try {
          decoded = await scanner.scanFile(file, false);
        } finally {
          try {
            // clear() returns a promise on this library; a scanner that never started
            // has nothing to clear and may reject or throw.
            void Promise.resolve(scanner.clear()).catch(() => {});
          } catch {
            // nothing to clear
          }
        }
      } catch (thrown) {
        // scanFile rejects when no code is found; a failed chunk load rejects too, with
        // an Error from the dynamic import.
        const loadFailed = thrown instanceof Error && /Loading chunk|ChunkLoadError|dynamically imported module/i.test(`${thrown.name} ${thrown.message}`);
        notify.error(
          loadFailed ? "Couldn't load the QR reader." : 'No QR code found in that image.',
          {
            id: attempt,
            description: loadFailed ? 'Check your connection, then try again.' : 'Try a clearer, closer photo of the whole code.',
          },
        );
        return;
      }

      const parsed = parseCenterQr(decoded, userBarangayId);
      if (!parsed.ok) {
        notify.error(parsed.title, { id: attempt });
        return;
      }

      if (mountedRef.current) setStage('checking-in');
      await completeCheckIn({
        centerId: parsed.centerId,
        attempt,
        checkIn,
        updateHouseholdStatus,
        lastCheckInFailure,
      });
    } catch {
      notify.error("Couldn't read that image.", { id: attempt, description: 'Please try another photo.' });
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setStage(null);
    }
  }

  const busy = stage !== null;

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-center">
      <div id="qr-upload-fallback-hidden" className="hidden" />
      <p className="text-xs text-muted-foreground">No working camera? Upload a photo of the QR code instead.</p>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
        {busy ? <Spinner className="size-3.5" /> : <Upload aria-hidden size={14} />}
        <span className="inline-grid">
          <span className={busy ? 'invisible col-start-1 row-start-1' : 'col-start-1 row-start-1'}>Upload QR Image</span>
          <span aria-hidden={!busy} className={busy ? 'col-start-1 row-start-1' : 'invisible col-start-1 row-start-1'}>
            {stage === 'checking-in' ? 'Checking in…' : 'Reading image…'}
          </span>
        </span>
      </button>
      <LoadingStatus active={busy} label={stage === 'checking-in' ? 'Recording your check-in…' : 'Reading the QR image…'} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="QR code image"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
