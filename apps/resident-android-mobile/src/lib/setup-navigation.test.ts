import { describe, expect, it } from 'vitest';
import { residentSetupRoute, type ResidentAccountSetupStatus } from '@barangayan/shared';
import { callbackNavigation, isNativeAuthCallback, markNativeCallbackHandedOff, nativeCallbackPending, reauthReturnTarget, setupAllowsApp, setupDestination } from './setup-navigation';
const email: ResidentAccountSetupStatus = { registrationOrigin:'email_otp', profileComplete:false,passwordSet:false,hasGoogleIdentity:false };
function decide(status: ResidentAccountSetupStatus, intent: Parameters<typeof residentSetupRoute>[0]['intent']='sign_in') {
  const setup = { state:'ready' as const, status };
  const route = residentSetupRoute({session:'authenticated',intent,setup});
  return {route,allowed:setupAllowsApp(route,setup),destination:setupDestination(route,setup)};
}
describe('root and callback bind the same server setup routing contract', () => {
  it('holds an email-origin session through details and password, including linked/guest flags and restarts', () => {
    expect(decide(email).destination).toBe('/account-setup');
    expect(decide({...email,profileComplete:true,hasGoogleIdentity:true},'sign_in').allowed).toBe(false);
    expect(decide({...email,profileComplete:true,passwordSet:true}).destination).toBe('/home');
    const route=residentSetupRoute({session:'authenticated',intent:'sign_in',guest:true,setup:{state:'ready',status:email}});
    expect(route).toEqual({destination:'details',required:true,returnTo:'home'});
  });
  it('preserves unknown credentials and supplies existing Settings management only for eligible accounts', () => {
    expect(decide({...email,profileComplete:true,passwordSet:null}).allowed).toBe(false);
    expect(decide({...email,registrationOrigin:'legacy',passwordSet:null},'settings_password').destination).toBe('/settings/change-password');
    expect(decide({...email,profileComplete:true,passwordSet:true},'settings_password').destination).toBe('/settings/change-password');
  });
  it('Google sign-in skips optional setup while signup, saved details and both skips remain distinct', () => {
    const google={...email,registrationOrigin:'google' as const,hasGoogleIdentity:true};
    expect(decide(google,'sign_in').destination).toBe('/home');
    expect(decide(google,'google_signup').route).toEqual({destination:'details',required:false,returnTo:'home'});
    expect(decide({...google,profileComplete:true},'google_details_saved').route).toEqual({destination:'password',required:false,returnTo:'home'});
    expect(decide({...google,profileComplete:true},'sign_in').destination).toBe('/home');
    expect(decide(google,'settings_profile').destination).toBe('/settings/profile');
  });
  it('loading/error never grants app access; restoration and recovery precede setup and guest', () => {
    for(const setup of [{state:'loading' as const},{state:'error' as const,failure:{kind:'network' as const,message:'retry',retryable:true}}]) {
      const route=residentSetupRoute({session:'authenticated',intent:'email_signup',setup,guest:true});
      expect(setupAllowsApp(route,setup)).toBe(false);
    }
    expect(residentSetupRoute({session:'restoring',intent:'sign_in',recovery:true,guest:true}).destination).toBe('restoring');
    expect(residentSetupRoute({session:'authenticated',intent:'google_signup',recovery:true,guest:true}).destination).toBe('recovery');
    expect(residentSetupRoute({session:'signed_out',intent:'sign_in',guest:true}).destination).toBe('home');
    const staff=residentSetupRoute({session:'authenticated',intent:'google_signup',actor:'staff'});
    expect(setupAllowsApp(staff,{state:'loading'})).toBe(true);
  });
});

describe('Google callback return after Settings reauthentication', () => {
  const base = { finished:true, recovery:false, signedIn:true, statusLoading:false, reauthTarget:null, appAllowed:true, canGoBack:true, destination:'/home' as const };
  it('maps each purpose to the Settings screen that started it', () => {
    expect(reauthReturnTarget('set_password')).toBe('/settings/change-password');
    expect(reauthReturnTarget('delete_account')).toBe('/settings');
  });
  it('a warm return goes back to the originating screen instead of mounting a duplicate; cold start opens it', () => {
    expect(callbackNavigation({...base,reauthTarget:'/settings'})).toEqual({type:'back'});
    expect(callbackNavigation({...base,reauthTarget:'/settings/change-password',canGoBack:false})).toEqual({type:'replace',href:'/settings/change-password'});
  });
  it('waits for the exchange, session and status; recovery always takes precedence', () => {
    expect(callbackNavigation({...base,finished:false,reauthTarget:'/settings'})).toEqual({type:'none'});
    expect(callbackNavigation({...base,statusLoading:true,reauthTarget:'/settings'})).toEqual({type:'none'});
    expect(callbackNavigation({...base,signedIn:false})).toEqual({type:'none'});
    expect(callbackNavigation({...base,recovery:true,reauthTarget:'/settings'})).toEqual({type:'replace',href:'/(auth)/forgot-password'});
  });
  it('reauthentication cannot reopen Settings for an account whose required email setup is unfinished', () => {
    expect(callbackNavigation({...base,reauthTarget:'/settings',appAllowed:false,destination:'/account-setup'})).toEqual({type:'replace',href:'/account-setup'});
  });
  it('sign-in/sign-up callbacks replace with the server-derived destination, never going back', () => {
    expect(callbackNavigation({...base,destination:'/account-setup',appAllowed:false})).toEqual({type:'replace',href:'/account-setup'});
    expect(callbackNavigation(base)).toEqual({type:'replace',href:'/home'});
  });
});
describe('native callback hand-off (Android cold start into the existing task)', () => {
  it('recognises only the exact native callback route', () => {
    expect(isNativeAuthCallback('barangayan://auth/callback?code=x')).toBe(true);
    expect(isNativeAuthCallback('barangayan://auth/callback')).toBe(true);
    for (const url of [null, undefined, '', 'barangayan:///settings/profile', 'barangayan://auth/callbacks?code=x', 'https://auth/callback?code=x', 'not a url'])
      expect(isNativeAuthCallback(url)).toBe(false);
  });
  it('holds the root redirect until that callback URL is handed off, then never again', () => {
    const url = 'barangayan://auth/callback?code=handoff-test';
    expect(nativeCallbackPending(url)).toBe(true);
    markNativeCallbackHandedOff(url);
    expect(nativeCallbackPending(url)).toBe(false);
    expect(nativeCallbackPending('barangayan://auth/callback?code=next-attempt')).toBe(true);
    expect(nativeCallbackPending('barangayan:///home')).toBe(false);
  });
});
