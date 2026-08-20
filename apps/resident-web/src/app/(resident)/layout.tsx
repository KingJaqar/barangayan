import { ResidentShell } from '@/components/shell/resident-shell';
import { UnreadCountsProvider } from '@/hooks/use-unread-counts';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/**
 * Shell for every route under (resident) — the resident-web counterpart of the mobile
 * app's (app) group. Deliberately does NOT gate here: per the plan's Phase 0 design
 * choice, every gated page calls requireUser() itself (e.g. /services/requests will,
 * once Phase 3 exists) rather than this layout enforcing one blanket policy that would
 * break /home's guest-browsing requirement (§4's Route Contract Matrix: /home must use
 * getOptionalUser(), never requireUser()).
 *
 * An admin session is still bounced from here (getOptionalUser() redirects to
 * admin-web's /dashboard) — an admin should never see the resident shell at all, guest
 * or not.
 */
export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getOptionalUser();

  return (
    <UnreadCountsProvider userId={user?.id ?? null}>
      <ResidentShell
        barangayName={profile?.barangayName ?? 'Barangay'}
        residentName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        isAuthenticated={user !== null}>
        {children}
      </ResidentShell>
    </UnreadCountsProvider>
  );
}
