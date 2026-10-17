import { Component, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { ThemeControllerProvider, useThemeController } from '../src/components/theme/theme-controller';
import { AccentControllerProvider } from '../src/components/theme/accent-controller';
import { FontControllerProvider } from '../src/components/theme/font-controller';
import { Toaster } from '../src/components/ui/sonner';
import { NotificationSession } from '../src/components/shared/notification-session';
import { ForgotPasswordDialog } from '../src/app/(resident)/settings/change-password/forgot-password-dialog';
import { EmailVerificationForm } from '../src/app/(resident)/settings/email-verification/verification-form';
import { DeleteAccountForm } from '../src/app/(resident)/settings/delete-account/delete-account-form';
import ForgotPassword from '../src/app/(auth)/forgot-password/page';
import VerifyOtp from '../src/app/(auth)/verify-otp/verify-otp-form';
import ResetPassword from '../src/app/(auth)/reset-password/reset-password-form';
import Login from '../src/app/(auth)/login/page';
import { RegisterForm } from '../src/app/(auth)/register/register-form';
import { GoogleButton } from '../src/components/auth/google-button';
import { useSignOut } from '../src/hooks/use-sign-out';

const fx = window.__authToast;
const owner = { userId: 'resident-a', email: 'resident@example.test', sessionId: 'session-a' };
// Match Next 16.3 AppRouter's global fallback for redirects from standalone transitions.
function handleRedirect(event) {
  const error = 'reason' in event ? event.reason : event.error;
  if (!isRedirectError(error)) return;
  event.preventDefault();
  history.replaceState({}, '', error.digest.split(';')[2]);
}
window.addEventListener('error', handleRedirect);
window.addEventListener('unhandledrejection', handleRedirect);
const recovery = action => async () => {
  fx.calls.push(action);
  await fx.wait(action);
  if (fx.recovery === 'throw') throw new TypeError('synthetic lost reply');
  if (fx.recovery === 'redirect') throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/reset-password?source=settings;307;' });
  return fx.recovery ? { ok: false, kind: fx.recovery, message: 'Review your recovery details.' } : { ok: true };
};
const settings = { owner, verify: recovery('verify'), resend: recovery('resend'), update: recovery('update'), finish };
async function finish() {
  fx.calls.push('finish');
  await fx.wait('finish');
  if (fx.navigationFails) throw new Error('synthetic navigation failure');
  if (fx.finishRedirect) throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login?passwordReset=success;307;' });
  history.replaceState({}, '', '/login?passwordReset=success');
}
class RedirectBoundary extends Component {
  state = { redirected: false };
  static getDerivedStateFromError(error) {
    if (!isRedirectError(error)) throw error;
    return { redirected: true };
  }
  componentDidCatch(error) { history.replaceState({}, '', error.digest.split(';')[2]); }
  render() { return this.state.redirected ? <p>Destination opened</p> : this.props.children; }
}
function Logout() {
  const { signOut, pending } = useSignOut();
  return <button disabled={pending} onClick={() => void signOut()}>Log out</button>;
}
function ThemeProbe() {
  const { setTheme } = useThemeController();
  useEffect(() => { fx.setTheme = setTheme; return () => { delete fx.setTheme; }; }, [setTheme]);
  return null;
}
function Fixture() {
  const [userId, setUserId] = useState(fx.owner);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    fx.renderOwner = setUserId;
    fx.hide = () => setVisible(false);
    return () => { delete fx.renderOwner; delete fx.hide; };
  }, []);
  return <ThemeControllerProvider><AccentControllerProvider><FontControllerProvider>
    <ThemeProbe />
    <NotificationSession userId={userId} />
    <main className="mx-auto max-w-3xl p-6"><RedirectBoundary>{visible && (
      fx.screen === 'dialog' ? <ForgotPasswordDialog userId={owner.userId} email={owner.email} unavailable={fx.unavailable ? { ok: false, kind: 'unverified', message: 'Verify your email first.' } : undefined} checkEligibility={recovery('check')} sendCode={recovery('send')} resendCode={recovery('resend')} verifyCode={recovery('verify')} updatePassword={recovery('update')} finish={finish} />
      : fx.screen === 'email' ? <EmailVerificationForm userId={owner.userId} email={owner.email} profileEmail={fx.mismatch ? 'old@example.test' : owner.email} initialStatus={fx.emailStatus ?? 'pending'} pendingEmail={fx.pendingEmail ?? ''} />
      : fx.screen === 'forgot' ? <ForgotPassword />
      : fx.screen === 'verify' ? <VerifyOtp settings={fx.settings ? settings : undefined} />
      : fx.screen === 'reset' ? <ResetPassword settings={fx.settings ? settings : undefined} />
      : fx.screen === 'delete' ? <DeleteAccountForm email={fx.missingEmail ? '' : owner.email} />
      : fx.screen === 'register' ? <RegisterForm />
      : fx.screen === 'login' ? <Login />
      : fx.screen === 'logout' ? <Logout />
      : <GoogleButton label="Continue with Google" link={fx.link} />
    )}</RedirectBoundary></main>
    <Toaster />
  </FontControllerProvider></AccentControllerProvider></ThemeControllerProvider>;
}
createRoot(document.getElementById('root'), { onCaughtError: error => { if (!isRedirectError(error)) fx.errors.push(String(error)); } }).render(<StrictMode><Fixture /></StrictMode>);
