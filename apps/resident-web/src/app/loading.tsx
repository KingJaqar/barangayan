import { LoadingStatus } from '@/components/shared/loading-status';

/**
 * Neutral root fallback for waits in the (resident) and (auth) layouts, which read the
 * session before rendering (Next 16.3: a segment's own loading.js cannot cover its
 * layout's runtime data, so this boundary sits one level up). It shows no shell, header,
 * or account-specific shapes because the session isn't known yet. The label and spinner
 * appear only after the shared 120 ms delay, so fast loads never flash it.
 */
export default function RootLoading() {
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-background p-6">
      <LoadingStatus active label="Loading Barangayan…" />
    </div>
  );
}
