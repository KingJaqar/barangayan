import { ServicesSegmentNav } from '@/components/services/services-segment-nav';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/**
 * Shared chrome for every route under /services — the plan's Phase 3 3-segment nav
 * (Documents/Requests/Logs), same "layout owns the nav, each segment is a real route"
 * pattern as Phase 2's emergency/layout.tsx. Deliberately does NOT gate here (same
 * reasoning as the (resident) layout above it): /services/documents and
 * /services/[documentId] are guest-accessible (0005 migration's anon read policy on
 * document_types), so a blanket requireUser() here would break guest catalog browsing.
 * Every other route under /services calls requireUser() itself.
 */
export default async function ServicesLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getOptionalUser();

  return (
    <div className="mx-auto max-w-4xl">
      <ServicesSegmentNav isAuthenticated={user !== null} />
      {children}
    </div>
  );
}
