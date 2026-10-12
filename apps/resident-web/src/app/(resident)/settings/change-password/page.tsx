import { requireUser } from '@/lib/auth/require-user';
import { ChangePasswordForm } from './change-password-form';
import { ForgotPasswordDialog } from './forgot-password-dialog';
import { getSettingsRecoveryAccount, sendSettingsRecoveryCode } from '@/lib/auth/settings-recovery';
import { clearSettingsRecoveryIntent, getSettingsRecoveryState, verifySettingsRecoveryCode, updateSettingsRecoveryPassword } from '@/lib/auth/settings-recovery';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Change Password' };

export default async function ChangePasswordPage() {
  const { user } = await requireUser();
  const account = await getSettingsRecoveryAccount();
  // Before a code is requested, validate the current session for this account,
  // rather than a session ID captured in a cached Settings page. Sending records
  // the current session; verification/resend/update remain bound to that session.
  const expected = { userId: user.id, email: user.email ?? '' };
  async function checkEligibility() {
    'use server';
    const fresh = await getSettingsRecoveryAccount(expected);
    return 'ok' in fresh ? fresh : { ok: true as const };
  }
  async function sendCode() {
    'use server';
    // Re-read eligibility: a render-time outage or email verification in another
    // tab must not permanently disable recovery for this mounted page.
    const fresh = await getSettingsRecoveryAccount(expected);
    return 'ok' in fresh ? fresh : sendSettingsRecoveryCode(fresh);
  }
  async function resendCode() {
    'use server';
    const state = await getSettingsRecoveryState(false, expected);
    return 'ok' in state ? state : sendSettingsRecoveryCode(state, true);
  }
  async function verifyCode(code: string) {
    'use server';
    const state = await getSettingsRecoveryState(false, expected);
    return 'ok' in state ? state : verifySettingsRecoveryCode(state, code);
  }
  async function updatePassword(password: string, confirmPassword: string) {
    'use server';
    const state = await getSettingsRecoveryState(true, expected);
    return 'ok' in state ? state : updateSettingsRecoveryPassword(state, password, confirmPassword);
  }
  async function finish() {
    'use server';
    await clearSettingsRecoveryIntent();
    redirect('/login?passwordReset=success');
  }
  // Pass the email so the form can re-authenticate via signInWithPassword — Supabase's
  // updateUser() doesn't verify the old password, so we gate behind a re-auth step.
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Change Password</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Enter your current password, then choose a new one (at least 8 characters).
        </p>
      </div>
      <ChangePasswordForm email={user.email ?? ''} forgotPassword={
        <ForgotPasswordDialog userId={user.id} email={user.email ?? ''} unavailable={'ok' in account ? account : undefined} checkEligibility={checkEligibility} sendCode={sendCode} resendCode={resendCode} verifyCode={verifyCode} updatePassword={updatePassword} finish={finish} />
      } />
    </div>
  );
}
