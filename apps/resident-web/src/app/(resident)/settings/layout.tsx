import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SettingsSidebar } from './settings-sidebar';

async function logoutAction() {
  'use server';
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Shell for every /settings/* route: a fixed-width (256px) nav sidebar on the left —
 * styled like admin-web's real SidebarNav, not a percentage-split pane — and the
 * routed page filling the rest. Each settings page keeps its own `mx-auto max-w-*`
 * content wrapper, so it simply centers within the remaining space.
 *
 * Deliberately no `items-start` on the row: that would size the <aside> flex item to
 * only its own (short) content height, leaving `position: sticky` nothing to stick
 * within past that point — the sidebar would scroll away as soon as a taller content
 * pane was scrolled further than the nav's own height. Default `items-stretch`
 * stretches <aside> to match the content pane's height instead, so the sticky inner
 * div (settings-sidebar.tsx) has the full scroll range to stay pinned in view.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let emailVerified = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('email_verification_status').eq('id', user.id).single();
    emailVerified = profile?.email_verification_status === 'verified';
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
      <SettingsSidebar logoutAction={logoutAction} emailVerified={emailVerified} isAuthenticated={user !== null} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
