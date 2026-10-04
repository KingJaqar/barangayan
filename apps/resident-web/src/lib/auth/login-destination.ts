import { safeResidentRedirect } from '@barangayan/shared';
export function getResidentLoginDestination(next: string | null, onboarded: boolean): string {
  return onboarded ? safeResidentRedirect(next) : '/onboarding';
}
