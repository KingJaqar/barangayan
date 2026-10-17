// Real client components; every external outcome below is synthetic and tab-local.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useRouter } from 'next/navigation';
import { ThemeControllerProvider } from '../src/components/theme/theme-controller';
import { AccentControllerProvider } from '../src/components/theme/accent-controller';
import { FontControllerProvider } from '../src/components/theme/font-controller';
import { ThemeForm } from '../src/app/(resident)/settings/theme/theme-form';
import { Toaster } from '../src/components/ui/sonner';
import { NotificationSession } from '../src/components/shared/notification-session';
import { UnreadCountsProvider, useUnreadCounts } from '../src/hooks/use-unread-counts';
import { AnnouncementCard } from '../src/components/reports/announcement-card';
import { IncidentCard } from '../src/components/reports/incident-card';
import { ForgotPasswordDialog } from '../src/app/(resident)/settings/change-password/forgot-password-dialog';
import { EmailVerificationForm } from '../src/app/(resident)/settings/email-verification/verification-form';
import { DeleteAccountForm } from '../src/app/(resident)/settings/delete-account/delete-account-form';
import ForgotPassword from '../src/app/(auth)/forgot-password/page';
import VerifyOtp from '../src/app/(auth)/verify-otp/verify-otp-form';
import ResetPassword from '../src/app/(auth)/reset-password/reset-password-form';
import { RegisterForm } from '../src/app/(auth)/register/register-form';
import { GoogleButton } from '../src/components/auth/google-button';
import { AnnouncementsFeed } from '../src/app/(resident)/announcements/announcements-feed';
import AuthErrorPage from '../src/app/auth/error/page';
import { beginAttempt, notify } from '../src/lib/notify';

const owner = { userId: 'resident-a', email: 'resident@example.test', sessionId: 'session-a' };
const fx = window.__fx;
function ReadCards() {
  const counts = useUnreadCounts();
  useEffect(() => {
    window.__readCounts = counts;
    return () => { delete window.__readCounts; };
  }, [counts]);
  return <><AnnouncementCard announcement={{ id: 'announcement-a', category: 'general', title: 'Fixture announcement', body: 'Fixture body.', published_at: '2026-10-15T00:00:00Z' }} onPress={() => {}} />
    <IncidentCard incident={{ id: 'incident-a', title: 'Fixture report', status: 'resolved', resolved_read_at: fx.incidentRead ? '2026-10-15T00:00:00Z' : null, created_at: '2026-10-15T00:00:00Z' }} selected={false} onSelect={() => {}} /></>;
}
function Fixture() {
  const [userId, setUserId] = useState(fx.owner);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    fx.hide = () => setVisible(false);
    fx.renderOwner = setUserId;
    return () => { delete fx.hide; delete fx.renderOwner; };
  }, []);
  const router = useRouter();
  const finish = async () => { if (fx.navigationFails) throw new Error('synthetic navigation failure'); router.replace('/login?passwordReset=success'); };
  const recovery = action => async () => {
    fx.calls.push({ action });
    await fx.wait(action);
    if (fx.recovery === 'throw') throw new TypeError('synthetic connection loss');
    if (fx.recovery && fx.recovery !== 'success') return { ok: false, kind: fx.recovery, message: fx.recovery === 'unverified' ? 'Verify your email first.' : 'Please review your recovery details.' };
    return { ok: true };
  };
  return <ThemeControllerProvider><AccentControllerProvider><FontControllerProvider>
    {fx.screen !== 'callback-error' ? <NotificationSession userId={userId} /> : null}
    <main className="mx-auto max-w-4xl p-6">{visible && (fx.screen === 'theme' ? <ThemeForm userId={userId} savedTheme={null} savedAccent={null} savedFont={null} />
      : fx.screen === 'reads' ? <UnreadCountsProvider userId={userId}><ReadCards /></UnreadCountsProvider>
      : fx.screen === 'bulk' ? <UnreadCountsProvider userId={userId}><AnnouncementsFeed barangayId="fixture" /></UnreadCountsProvider>
      : fx.screen === 'dialog' ? <ForgotPasswordDialog userId={owner.userId} email={owner.email} checkEligibility={recovery('check')} sendCode={recovery('send')} resendCode={recovery('resend')} verifyCode={recovery('verify')} updatePassword={recovery('update')} finish={finish} />
      : fx.screen === 'email' ? <EmailVerificationForm userId={owner.userId} email={owner.email} profileEmail={fx.mismatch ? 'old@example.test' : owner.email} initialStatus={fx.emailStatus ?? 'pending'} pendingEmail={fx.pendingEmail ?? ''} />
      : fx.screen === 'forgot' ? <ForgotPassword />
      : fx.screen === 'verify' ? <VerifyOtp settings={fx.settings ? { owner, verify: recovery('verify'), resend: recovery('resend') } : undefined} />
      : fx.screen === 'reset' ? <ResetPassword settings={fx.settings ? { owner, update: recovery('update'), finish } : undefined} />
      : fx.screen === 'delete' ? <DeleteAccountForm email={owner.email} />
      : fx.screen === 'register' ? <RegisterForm />
      : fx.screen === 'callback-error' ? <AuthErrorPage />
      : <GoogleButton label="Continue with Google" link={fx.link} />)}</main>
    <Toaster />
  </FontControllerProvider></AccentControllerProvider></ThemeControllerProvider>;
}
window.__notifyFixture = { beginAttempt, notify };
createRoot(document.getElementById('root')).render(<StrictMode><Fixture /></StrictMode>);
