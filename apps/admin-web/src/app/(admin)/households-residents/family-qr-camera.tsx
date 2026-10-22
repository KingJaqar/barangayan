'use client';

import { useEffect, useId, useState } from 'react';

export function FamilyQrCamera({ onDecoded, onClose }: { onDecoded: (raw: string) => void; onClose: () => void }) {
  const id = useId().replaceAll(':', '');
  const [message, setMessage] = useState('Starting camera…');
  useEffect(() => {
    const host = document.getElementById(id);
    if (!host) return;
    let cancelled = false;
    let decoded = false;
    let scanner: import('html5-qrcode').Html5Qrcode | undefined;
    let stopping: Promise<void> | undefined;
    const stopNativeTracks = () => {
      const video = host.querySelector('video');
      if (video?.srcObject instanceof MediaStream) video.srcObject.getTracks().forEach(track => track.stop());
    };
    // Permission may resolve after React detaches the host, before the reader's
    // start promise settles or isScanning becomes true. Retain this one-shot
    // guard on that host so the late native stream is released immediately.
    host.addEventListener('loadedmetadata', () => { if (cancelled) stopNativeTracks(); }, { capture: true, once: true });
    const stop = () => {
      if (cancelled) stopNativeTracks();
      if (!scanner?.isScanning) return Promise.resolve();
      stopping ??= scanner.stop().catch(() => {
        stopNativeTracks();
      });
      return stopping;
    };
    const timer = setTimeout(() => {
      cancelled = true; setMessage('Camera startup timed out. Close the camera and try again, or select a resident below.'); void stop();
    }, 15000);
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;
        scanner = new Html5Qrcode(id, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
        await scanner.start({ facingMode: 'environment' }, { fps: 8 }, raw => {
          if (cancelled || decoded) return;
          decoded = true;
          void stop().then(() => { if (!cancelled) onDecoded(raw); });
        }, undefined);
        clearTimeout(timer);
        if (cancelled) await stop();
        else setMessage('Point the camera at a resident’s Family QR.');
      } catch (cause) {
        clearTimeout(timer);
        if (cancelled) return;
        const text = cause instanceof Error ? `${cause.name} ${cause.message}` : String(cause);
        setMessage(/NotAllowed|Permission|SecurityError/i.test(text)
          ? 'Camera permission was denied. Allow access in browser settings, or select a resident below.'
          : /NotFound|DevicesNotFound/i.test(text)
            ? 'No camera was found. Select a resident below.'
            : 'The camera is unavailable. Use an HTTPS page and a supported browser, or select a resident below.');
      }
    })();
    const background = () => { if (document.visibilityState === 'hidden') { cancelled = true; void stop(); onClose(); } };
    document.addEventListener('visibilitychange', background);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', background); void stop(); };
  }, [id, onClose, onDecoded]);
  return <section aria-label="Family QR camera" className="space-y-3">
    <div id={id} className="w-full overflow-hidden rounded-xl" />
    <p role="status">{message}</p>
    <button type="button" className="ab-btn ab-btn-ghost" onClick={onClose}>Close camera</button>
  </section>;
}
