'use client';

import { CameraOff, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { LoadingStatus } from '@/components/shared/loading-status';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/loading';
import { useQrCheckins } from '@/hooks/use-qr-checkins';
import { beginAttempt, notify } from '@/lib/notify';
import { completeCheckIn, parseCenterQr } from '@/lib/qr-checkin';

type ScanState = 'starting' | 'scanning' | 'unavailable' | 'processing';
type CameraProblem = 'denied' | 'no-camera' | 'in-use' | 'unsupported' | 'unknown';

const CAMERA_GUIDANCE: Record<CameraProblem, { title: string; body: string }> = {
  denied: {
    title: 'Camera access is blocked.',
    body: "Allow camera access in your browser's site settings, then try again — or close this screen and use Upload QR Image instead.",
  },
  'no-camera': {
    title: 'No camera was found on this device.',
    body: 'Close this screen and use Upload QR Image to check in with a photo of the code.',
  },
  'in-use': {
    title: 'The camera is in use by another app.',
    body: 'Close the other app or tab using the camera, then try again — or close this screen and use Upload QR Image.',
  },
  unsupported: {
    title: "This browser can't open the camera here.",
    body: 'Camera scanning needs a secure (https) page and a supported browser. Close this screen and use Upload QR Image instead.',
  },
  unknown: {
    title: "We couldn't start the camera.",
    body: 'Try again, or close this screen and use Upload QR Image to check in with a photo of the code.',
  },
};

/** Classifies a failed camera start for guidance only (never a business outcome).
 * html5-qrcode rejects with a string or an Error that names the browser's DOMException. */
function cameraProblem(thrown: unknown): CameraProblem {
  const text = typeof thrown === 'string' ? thrown : thrown instanceof Error ? `${thrown.name} ${thrown.message}` : '';
  if (/NotAllowed|Permission|SecurityError/i.test(text)) return 'denied';
  if (/NotFound|DevicesNotFound|no camera/i.test(text)) return 'no-camera';
  if (/NotReadable|TrackStart|in use/i.test(text)) return 'in-use';
  if (/not supported|insecure|mediaDevices/i.test(text)) return 'unsupported';
  return 'unknown';
}

/**
 * Web port of qr-scanner-overlay.tsx + qr-permission-modal.tsx, merged into one dialog —
 * the browser's own permission prompt replaces the native app's pre-flight
 * `Camera.getCameraPermissionsAsync()` check (there's no JS API to query camera
 * permission state consistently across browsers ahead of `getUserMedia`), so this shows
 * a denied-state message reactively instead of pre-emptively. Validates the scanned
 * payload against evacuationCenterQrPayloadSchema before calling checkIn(), exactly like
 * the mobile version [C-011, C-012].
 *
 * Feedback plan RW-LT-05: the QR reader loads inside the guarded start so a failed chunk
 * ends in guidance instead of an endless "starting" spinner; a camera that finishes
 * starting after the dialog closed is stopped; repeated decodes of the same code run one
 * check-in; each scan yields one terminal notification (see lib/qr-checkin.ts), and a
 * result that arrives after the dialog was closed still notifies but never touches the
 * closed dialog.
 */
export function QrScannerDialog({ open, onClose, userId, barangayId, userBarangayId }: { open: boolean; onClose: () => void; userId: string | null; barangayId: string | null; userBarangayId: string | null }) {
  const elementId = useId().replace(/[:]/g, '');
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<ScanState>('starting');
  const [problem, setProblem] = useState<CameraProblem>('unknown');
  const [startAttempt, setStartAttempt] = useState(0);
  const { checkIn, updateHouseholdStatus, lastCheckInFailure } = useQrCheckins(userId, barangayId);
  // The effect below is intentionally keyed on open/attempt only, so it reads the latest
  // callbacks through a ref.
  const latest = useRef({ checkIn, updateHouseholdStatus, lastCheckInFailure, onClose, userBarangayId });
  useEffect(() => {
    latest.current = { checkIn, updateHouseholdStatus, lastCheckInFailure, onClose, userBarangayId };
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let processing = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
    // react-hooks/set-state-in-effect.
    Promise.resolve().then(() => {
      if (!cancelled) setState('starting');
    });

    function resumeScanning() {
      processing = false;
      if (cancelled) return;
      setState('scanning');
      try {
        scanner?.resume();
      } catch {
        // ignore
      }
    }

    async function handleDecoded(raw: string) {
      if (cancelled || processing || !scanner) return;
      // One check-in per decode burst: the reader can report the same frame again before
      // pause() takes effect.
      processing = true;
      setState('processing');
      try {
        scanner.pause(true);
      } catch {
        // already stopped
      }

      const attempt = beginAttempt('qr-checkin');
      const parsed = parseCenterQr(raw, latest.current.userBarangayId);
      if (!parsed.ok) {
        notify.error(parsed.title, { id: attempt });
        resumeScanning();
        return;
      }

      const outcome = await completeCheckIn({
        centerId: parsed.centerId,
        attempt,
        checkIn: latest.current.checkIn,
        updateHouseholdStatus: latest.current.updateHouseholdStatus,
        lastCheckInFailure: latest.current.lastCheckInFailure,
      });
      // The notification above already reported the result. The dialog only updates
      // itself while it is still the one the scan came from.
      if (cancelled) return;
      if (outcome === 'recorded' || outcome === 'partial') latest.current.onClose();
      else resumeScanning();
    }

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const created = new Html5Qrcode(elementId);
        scanner = created;
        scannerRef.current = created;
        await created.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          (decodedText) => {
            void handleDecoded(decodedText);
          },
          undefined,
        );
        if (cancelled) {
          // The dialog closed while the camera was starting: release it now.
          await created.stop().catch(() => {});
          return;
        }
        setState('scanning');
      } catch (thrown) {
        if (cancelled) return;
        setProblem(cameraProblem(thrown));
        setState('unavailable');
      }
    }

    void start();

    return () => {
      cancelled = true;
      const active = scanner;
      scanner = null;
      scannerRef.current = null;
      if (active && active.isScanning) {
        active.stop().catch(() => {});
      }
    };
  }, [open, elementId, startAttempt]);

  // Escape closes (the overlay is a full-screen modal surface); focus starts on Close.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current.onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const guidance = CAMERA_GUIDANCE[problem];

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan QR code" className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-4">
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close scanner" className="flex h-11 w-11 items-center justify-center rounded-full text-white focus-visible:ring-2 focus-visible:ring-white">
          <X size={24} />
        </button>
        <p className="text-sm font-semibold text-white">Scan QR Code</p>
        <span className="w-11" />
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <div id={elementId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

        {state === 'unavailable' ? (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-8 text-center">
            <CameraOff aria-hidden size={40} className="text-white/70" />
            <p className="text-sm font-semibold text-white">{guidance.title}</p>
            <p className="max-w-sm text-xs text-white/70">{guidance.body}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" onClick={() => setStartAttempt((n) => n + 1)}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : state === 'starting' ? (
          <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
            <Spinner className="size-8" />
          </div>
        ) : (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-white/30" />
        )}
      </div>

      <div className="flex min-h-20 flex-col items-center gap-2 px-4 pb-10 pt-4">
        <p className="text-center text-sm text-white/90">Position the barangay QR code within the frame</p>
        <div className="text-white [&_span]:text-white">
          <LoadingStatus active={state === 'starting'} label="Starting camera…" />
          <LoadingStatus active={state === 'processing'} label="Checking you in…" />
        </div>
      </div>
    </div>
  );
}
