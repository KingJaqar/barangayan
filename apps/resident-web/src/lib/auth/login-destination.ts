/** Keep every role in resident-web and accept only local post-login return paths. */
export function getResidentLoginDestination(next: string | null, onboarded: boolean): string {
  if (!onboarded) return '/onboarding';
  if (!next?.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/home';

  try {
    // A fixed origin lets us validate paths without depending on the deployed host.
    const origin = 'https://resident.invalid';
    const destination = new URL(next, origin);
    if (destination.origin !== origin || destination.pathname.startsWith('//')) return '/home';

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return '/home';
  }
}
