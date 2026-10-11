import { useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
let navigationVersion = 0;
declare global { interface Window { fixtureNavigationDelay?: number } }
function changed() { for (const listener of listeners) listener(); }
window.addEventListener('popstate', changed);
export function useSearchParams() {
  const search = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => location.search);
  return new URLSearchParams(search);
}
export function usePathname() { return location.pathname; }
export function useRouter() {
  return { push(href: string, options: { scroll: boolean }) {
    window.dispatchEvent(new CustomEvent('fixture-navigation', { detail: { href, ...options } }));
    const version = ++navigationVersion;
    const apply = () => { if (version === navigationVersion) { history.pushState(null, '', href); changed(); } };
    if (window.fixtureNavigationDelay) setTimeout(apply, window.fixtureNavigationDelay); else apply();
  } };
}
