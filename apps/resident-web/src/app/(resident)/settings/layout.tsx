import type { ReactNode } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SettingsSidebar } from './settings-sidebar';
import { SettingsContent } from './settings-content';

/**
 * Shared desktop shell: sidebar and routed content scroll independently within
 * the available height. The sidebar stays mounted across settings navigation.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let emailVerified = false;
  let locationVerified = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verification_status, verified_location')
      .eq('id', user.id)
      .single();
    emailVerified = profile?.email_verification_status === 'verified';
    locationVerified = profile?.verified_location != null;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:h-full lg:min-h-0 lg:w-full lg:flex-1 lg:flex-row">
      <SettingsSidebar
        emailVerified={emailVerified}
        locationVerified={locationVerified}
        isAuthenticated={user !== null}
      />
      <SettingsContent>{children}</SettingsContent>
    </div>
  );
}
