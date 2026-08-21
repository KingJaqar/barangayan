import { redirect } from 'next/navigation';

import { getOptionalUser } from '@/lib/auth/get-optional-user';

// The settings sidebar's first item is Profile, so /settings itself just forwards
// there — the two-pane shell (settings/layout.tsx) always needs a selected page. Guests
// don't have a Profile (Account is hidden from their sidebar entirely, see
// settings-sidebar.tsx), so they forward to Theme & Appearance instead — the first
// group/item they can actually see.
export default async function SettingsPage() {
  const { user } = await getOptionalUser();
  redirect(user ? '/settings/profile' : '/settings/theme');
}
