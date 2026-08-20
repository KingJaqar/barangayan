import { MailWarning } from 'lucide-react';

/**
 * Informational only, per migration 0012's own column comment on
 * profiles.email_verification_status ("Never blocks login, dashboard, or services") —
 * there is no verification flow wired up yet anywhere in this plan's contract
 * inventory (§2), so this deliberately has no action button rather than linking to a
 * page that doesn't exist. Renders only for 'unverified'/'pending' — not 'unavailable'
 * (SMTP not configured; nothing for the resident to do) or 'verified'.
 */
export function EmailVerifyBanner({ status }: { status: string }) {
  if (status !== 'unverified' && status !== 'pending') return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm">
      <MailWarning size={18} className="shrink-0 text-status-warning" />
      <p className="text-foreground">
        {status === 'pending' ? 'Email verification pending.' : 'Your email address is not yet verified.'}
      </p>
    </div>
  );
}
