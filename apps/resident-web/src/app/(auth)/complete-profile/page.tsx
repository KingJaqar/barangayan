import { redirect } from 'next/navigation';
import { RegisterForm } from '../register/register-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function CompleteProfilePage() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  return <div className="mx-auto max-w-3xl p-6"><RegisterForm completing /></div>;
}
