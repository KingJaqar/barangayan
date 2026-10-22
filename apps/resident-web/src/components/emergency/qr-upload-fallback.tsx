'use client';

import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Spinner } from '@/components/ui/loading';
import { beginAttempt, notify } from '@/lib/notify';
import { explainStaffCheckIn, parseCenterQr } from '@/lib/qr-checkin';
import styles from './emergency.module.css';

type Stage = 'reading';

/**
 * New, desktop-only fallback for residents without (or unwilling to grant) a working
 * camera — decodes a QR code from an uploaded photo via html5-qrcode's scanFile(), same
 * validation and staff-confirmation guidance as the live scanner.
 *
 * Feedback plan RW-LT-05: one image at a time (a synchronous guard covers repeated
 * activation), an image-reading state, every
 * failure ends in one explanatory notification, and the file input is reset so the same
 * photo can be chosen again after a failure.
 */
export function QrUploadFallback({ userBarangayId }: { userId: string | null; barangayId: string | null; userBarangayId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [stage, setStage] = useState<Stage | null>(null);

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

      if (mountedRef.current) explainStaffCheckIn(attempt);
    } catch {
      notify.error("Couldn't read that image.", { id: attempt, description: 'Please try another photo.' });
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setStage(null);
    }
  }

  const busy = stage !== null;

  return (
    <div className={styles.upload}>
      <div id="qr-upload-fallback-hidden" className="hidden" />
      <p>No working camera? Upload a photo of the QR code instead.</p>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => inputRef.current?.click()}
        className={`${styles.secondaryButton} inline-flex items-center gap-2 disabled:opacity-50`}>
        {busy ? <Spinner className="size-3.5" /> : <Upload aria-hidden size={14} />}
        <span className="inline-grid">
          <span className={busy ? 'invisible col-start-1 row-start-1' : 'col-start-1 row-start-1'}>Upload QR Image</span>
          <span aria-hidden={!busy} className={busy ? 'col-start-1 row-start-1' : 'invisible col-start-1 row-start-1'}>
            Reading image…
          </span>
        </span>
      </button>
      <LoadingStatus active={busy} label="Reading the QR image…" />
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
