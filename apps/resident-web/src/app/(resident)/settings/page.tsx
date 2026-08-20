import { redirect } from 'next/navigation';

// The settings sidebar's first item is Profile, so /settings itself just forwards
// there — the two-pane shell (settings/layout.tsx) always needs a selected page.
export default function SettingsPage() {
  redirect('/settings/profile');
}
