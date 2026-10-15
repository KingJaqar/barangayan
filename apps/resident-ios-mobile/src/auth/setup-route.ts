import type { SetupLoad } from './setup-status';

/** Why the resident entered the setup coordinator; drives which optional step is offered next. */
export type SetupIntent =
  | 'sign_in' | 'email_signup' | 'provider_signup' | 'resume_profile' | 'provider_details_saved'
  | 'settings_profile' | 'settings_password';
export const SETUP_INTENTS: readonly SetupIntent[] = [
  'sign_in', 'email_signup', 'provider_signup', 'resume_profile', 'provider_details_saved', 'settings_profile', 'settings_password',
];

export type SetupRoute =
  | { destination: 'restoring' | 'status_loading' | 'status_error' | 'recovery' | 'existing_access' | 'login' | 'email' | 'code' | 'home' | 'settings_profile' | 'manage_password' }
  | { destination: 'details' | 'password'; required: boolean; returnTo: 'home' | 'settings' };

export type SetupRoutingInput = {
  session: 'restoring' | 'signed_out' | 'authenticated';
  intent: SetupIntent;
  recovery?: boolean;
  guest?: boolean;
  pendingCode?: boolean;
  actor?: 'resident' | 'staff' | 'blocked';
  setup?: SetupLoad;
};

/**
 * Pure decision from server-owned status. Local form state, a guest flag or a Settings intent can
 * never erase email-origin setup, and nothing here infers readiness from client state.
 */
export function setupRoute(input: SetupRoutingInput): SetupRoute {
  if (input.session === 'restoring') return { destination: 'restoring' };
  if (input.recovery) return { destination: 'recovery' };
  if (input.session === 'signed_out') {
    if (input.intent === 'email_signup') return { destination: input.pendingCode ? 'code' : 'email' };
    return { destination: input.guest ? 'home' : 'login' };
  }
  if (input.actor && input.actor !== 'resident') return { destination: 'existing_access' };
  if (!input.setup || input.setup.state === 'loading') return { destination: 'status_loading' };
  if (input.setup.state === 'error') return { destination: 'status_error' };
  const status = input.setup.status;
  const provider = status.hasGoogleIdentity || status.hasAppleIdentity;
  if (status.registrationOrigin === 'email_otp') {
    if (!status.profileComplete) return { destination: 'details', required: true, returnTo: 'home' };
    if (status.passwordSet === false) return { destination: 'password', required: true, returnTo: 'home' };
    if (status.passwordSet === null) return { destination: 'manage_password' };
  }
  if (input.intent === 'settings_profile') return { destination: 'settings_profile' };
  if (input.intent === 'settings_password') {
    if (status.passwordSet === false && provider) return { destination: 'password', required: false, returnTo: 'settings' };
    return { destination: 'manage_password' };
  }
  if (['provider_signup', 'resume_profile', 'provider_details_saved'].includes(input.intent) && !status.profileComplete) {
    return { destination: 'details', required: false, returnTo: 'home' };
  }
  if (input.intent === 'provider_details_saved' && status.profileComplete && status.passwordSet === false && provider) {
    return { destination: 'password', required: false, returnTo: 'home' };
  }
  return { destination: 'home' };
}

export type SetupDestination = '/home' | '/account-setup' | '/settings/profile' | '/settings/change-password';

export function setupAllowsApp(route: SetupRoute, setup: SetupLoad): boolean {
  if (['home', 'existing_access', 'settings_profile'].includes(route.destination)) return true;
  if (route.destination !== 'manage_password' || setup.state !== 'ready') return false;
  // An email-origin account with unresolved password history must first recover or confirm it.
  return !(setup.status.registrationOrigin === 'email_otp' && setup.status.passwordSet === null);
}

export function setupDestination(route: SetupRoute, setup: SetupLoad): SetupDestination {
  if (route.destination === 'settings_profile') return '/settings/profile';
  if (route.destination === 'manage_password' && setupAllowsApp(route, setup)) return '/settings/change-password';
  return setupAllowsApp(route, setup) ? '/home' : '/account-setup';
}

/** Authoritative password modes: an unknown legacy history is never "not set". */
export type PasswordMode = 'loading' | 'error' | 'change' | 'manage' | 'create_with_provider' | 'recover_only';
export function passwordMode(setup: SetupLoad): PasswordMode {
  if (setup.state !== 'ready') return setup.state;
  const { passwordSet, hasGoogleIdentity, hasAppleIdentity } = setup.status;
  if (passwordSet === true) return 'change';
  if (passwordSet === null) return 'manage';
  return hasGoogleIdentity || hasAppleIdentity ? 'create_with_provider' : 'recover_only';
}

export type SettingsRow = { title: string; subtitle: string; warning: boolean };
export function accountSettingsRows(setup: SetupLoad): { profile: SettingsRow; password: SettingsRow } {
  const mode = passwordMode(setup);
  const profile: SettingsRow = setup.state === 'loading' ? { title: 'Edit profile', subtitle: 'Checking personal details…', warning: false }
    : setup.state === 'error' ? { title: 'Edit profile', subtitle: 'Personal details status unavailable', warning: false }
    : setup.status.profileComplete ? { title: 'Edit profile', subtitle: '', warning: false }
    : { title: 'Edit profile', subtitle: 'Personal details incomplete', warning: true };
  const password: SettingsRow = mode === 'loading' ? { title: 'Password', subtitle: 'Checking password status…', warning: false }
    : mode === 'error' ? { title: 'Password', subtitle: 'Password status unavailable', warning: false }
    : mode === 'change' ? { title: 'Change password', subtitle: '', warning: false }
    : mode === 'manage' ? { title: 'Manage password', subtitle: 'Change or recover your existing password', warning: false }
    : { title: 'Set password', subtitle: 'Password not set', warning: true };
  return { profile, password };
}

/** Routes that serve a resident action and therefore need a committed profile. */
export function actionNeedsProfile(pathname: string): boolean {
  return /^\/services\/(request|requests|payment)(\/|$)/.test(pathname)
    || /^\/requests?(\/|$)/.test(pathname)
    || /^\/health\/register(\/|$)/.test(pathname)
    || /^\/reports\/new(\/|$)/.test(pathname);
}

/** Paths a signed-in resident may open while required setup is still outstanding. */
export function allowedDuringSetup(pathname: string): boolean {
  return /^\/(account-setup|emergency|complete-profile)(\/|$)/.test(pathname) || /^\/auth\/(recovery|callback|reset-password)(\/|$)/.test(pathname);
}
