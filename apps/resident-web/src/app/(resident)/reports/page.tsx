import { AuthGate } from '@/components/shared/auth-gate';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { MyReportsTabs } from './my-reports-tabs';

/**
 * My Reports is inherently personal (a guest has no reports to list, and incidents has
 * no anon insert policy — reporting requires a real account), so this stays a
 * guest-accessible route (getOptionalUser(), not requireUser()) that shows an inline
 * sign-in gate instead of force-navigating away — same pattern as Emergency's
 * Scan/Family and Health's My Registrations. Guests browsing the community incident
 * map already see public reports elsewhere (Maps tab); this screen is the personal list.
 */
export default async function ReportsPage() {
  const { user } = await getOptionalUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <AuthGate
          title="Log In to See Your Reports"
          description="Incident reports you've submitted are tied to your account. Log in or create one to report an incident and track its status."
          next="/reports"
        />
      </div>
    );
  }

  // Header, width, and tab/list layout all live in MyReportsTabs (client) — it needs to
  // react to whether the IncidentDrawer is open to reflow the page around it.
  return <MyReportsTabs />;
}
