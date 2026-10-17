import { redirect } from 'next/navigation';

/**
 * The landing page IS the guest home screen — /home already renders correctly for
 * both signed-out visitors and residents (getOptionalUser()), so root just canonicalizes
 * to it rather than duplicating that page at two routes. Visitors and residents
 * land directly on the site.
 */
export default function RootPage() {
  redirect('/home');
}
