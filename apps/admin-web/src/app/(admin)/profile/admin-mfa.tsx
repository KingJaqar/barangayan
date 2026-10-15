'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ProfileMfaForm } from '@/components/admin/profile-mfa-form';
import styles from './profile.module.css';

export function AdminProfileMfa() {
  const [auth] = useState(() => createSupabaseBrowserClient().auth);
  const router = useRouter();
  return <section className={`${styles.page} ${styles.section}`}><h1 className="mb-4 text-2xl font-bold">Verify admin sign-in</h1><p className="mb-5">Complete your account’s existing multi-factor sign-in to access your profile. This verification keeps your admin account and session in place.</p><ProfileMfaForm auth={auth} onVerified={() => router.refresh()} /></section>;
}
