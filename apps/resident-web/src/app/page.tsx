import { redirect } from 'next/navigation';

/**
 * The landing page IS the guest home screen — /home already renders correctly for
 * both signed-out visitors and residents (getOptionalUser()), so root just canonicalizes
 * to it rather than duplicating that page at two routes. This deliberately replaces the
 * old auth->/welcome / guest->/welcome branch: there is no pre-login onboarding wizard
 * on the website — a first-time visitor should land straight on the real site, not a
 * forced multi-screen intro (that pattern belongs to the mobile app's first-run flow,
 * not a website). See /onboarding for the post-login, one-time personalization step.
 */
export default function RootPage() {
  redirect('/home');
}
