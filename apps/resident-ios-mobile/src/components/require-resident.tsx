import { usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useAuthFlow } from '../auth/auth-flow';
import { useResident } from '../lib/runtime';
import { Destination, EmptyState, Screen } from './ui';

/**
 * Private-route guard: guests stay in the current destination and get an explained sign-in path
 * instead of private content. The allowlisted route is remembered so sign-in returns there once
 * required setup is committed.
 */
export function RequireResident({ purpose, children }: { purpose: string; children: ReactNode }) {
  const { session } = useResident();
  const { rememberDestination } = useAuthFlow();
  const pathname = usePathname();
  useEffect(() => {
    if (!session) rememberDestination(pathname);
  }, [session, pathname, rememberDestination]);
  if (session) return children;
  return <Screen><EmptyState title="Log in required" message={`Log in to ${purpose}. Public information remains available without an account.`}><Destination title="Log in or create an account" href="/auth/choice" /></EmptyState></Screen>;
}
