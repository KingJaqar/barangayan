import Link from 'next/link';
import { redirect } from 'next/navigation';
import ResetPasswordForm from './reset-password-form';
import { clearSettingsRecoveryIntent, getSettingsRecoveryState, updateSettingsRecoveryPassword } from '@/lib/auth/settings-recovery';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  if ((await searchParams).source !== 'settings') return <ResetPasswordForm />;
  const state = await getSettingsRecoveryState(true);
  if ('ok' in state) return <div className="mx-auto max-w-sm space-y-4 p-8"><h1 className="text-2xl font-bold">Password recovery</h1><p role="alert">{state.message}</p><Link href={state.href ?? '/settings/change-password'} className="underline">Back to Change Password</Link></div>;
  const owner = { userId: state.userId, email: state.email, sessionId: state.sessionId };
  async function update(password: string, confirmPassword: string) { 'use server'; return updateSettingsRecoveryPassword(owner, password, confirmPassword); }
  async function finish() { 'use server'; await clearSettingsRecoveryIntent(); redirect('/login?passwordReset=success'); }
  return <ResetPasswordForm settings={{ owner, update, finish }} />;
}
