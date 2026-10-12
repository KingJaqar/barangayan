import Link from 'next/link';
import { redirect } from 'next/navigation';
import VerifyOtpScreen from './verify-otp-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSettingsRecoveryState, sendSettingsRecoveryCode, verifySettingsRecoveryCode } from '@/lib/auth/settings-recovery';

export default async function VerifyOtpPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const params = await searchParams;
  if (params.source !== 'settings') {
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (user) redirect('/home');
    return <VerifyOtpScreen />;
  }
  const state = await getSettingsRecoveryState(false);
  if ('ok' in state) return <div className="mx-auto max-w-sm space-y-4 p-8"><h1 className="text-2xl font-bold">Password recovery</h1><p role="alert">{state.message}</p><Link href={state.href ?? '/settings/change-password'} className="underline">Back to Change Password</Link></div>;
  const owner = { userId: state.userId, email: state.email, sessionId: state.sessionId };
  async function verify(code: string) {
    'use server';
    const result = await verifySettingsRecoveryCode(owner, code);
    if (result.ok) redirect('/reset-password?source=settings');
    return result;
  }
  async function resend() { 'use server'; return sendSettingsRecoveryCode(owner, true); }
  return <VerifyOtpScreen settings={{ owner, verify, resend }} />;
}
