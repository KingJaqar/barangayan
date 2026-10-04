import { describe, expect, it } from 'vitest';
import { androidCallbackCode, safeResidentRedirect, residentActionNeedsProfile, residentCompletionDestination, residentNamePrefill } from './resident-auth';
import { profileCompletionSchema } from '../schemas/service-foundations';
import { isPointInPolygon } from './point-in-polygon';
import type { Polygon } from 'geojson';

describe('resident authentication boundaries', () => {
  it.each(['/home', '/announcements', '/maps', '/health', '/services/documents', '/services/123', '/reports', '/settings/help'])('allows incomplete-account browsing at %s', path => expect(residentActionNeedsProfile(path)).toBe(false));
  it.each(['/services/requests/new/id', '/services/request/id', '/services/payment/id', '/health/register/id', '/reports/new'])('requires completion for resident action %s', path => expect(residentActionNeedsProfile(path)).toBe(true));
  it('retains a safe attempted action after completion and rejects external destinations', () => {
    expect(residentCompletionDestination('/health/register/drive')).toBe('/complete-profile?next=%2Fhealth%2Fregister%2Fdrive');
    expect(residentCompletionDestination('https://evil.test')).toBe('/complete-profile?next=%2Fhome');
  });
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/auth/callback?code=replay', '/login', '/\n/evil.test'])('rejects unsafe return %s', value => expect(safeResidentRedirect(value)).toBe('/home'));
  it('preserves an internal journey', () => expect(safeResidentRedirect('/services/requests?filter=pending')).toBe('/services/requests?filter=pending'));
  it('accepts only the exact Android code callback', () => {
    expect(androidCallbackCode('barangayan://auth/callback?code=one')).toBe('one');
    for (const url of ['https://auth/callback?code=one','barangayan://else/callback?code=one','barangayan://auth:123/callback?code=one','barangayan://else@auth/callback?code=one','barangayan://auth/callback','barangayan://auth/callback?code=a&code=b','barangayan://auth/callback#error=token','barangayan://auth/callback?error=access_denied']) expect(() => androidCallbackCode(url)).toThrow();
  });
  it('completes without a password and rejects identity/tenant/outcome injection', () => {
    const input = { firstName: 'Test', lastName: 'Resident', houseNo: '1', street: 'Main', sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-01-01' };
    expect(profileCompletionSchema.safeParse(input).success).toBe(true);
    for (const injected of [{role:'admin'},{barangayId:'foreign'},{location:{gps:{lat:91,lng:1},home:null}},{location:{gps:null,home:{lat:1,lng:1,verified:true}}}]) expect(profileCompletionSchema.safeParse({...input,...injected}).success).toBe(false);
  });
});
describe('resident name suggestions from Google account metadata', () => {
  it('prefers structured names over the display name', () => {
    expect(residentNamePrefill({ given_name: 'Mary Ann', family_name: 'de la Cruz', full_name: 'Other Name' })).toEqual({ firstName: 'Mary Ann', lastName: 'de la Cruz' });
  });
  it('fills both fields when the provider supplies only full_name', () => {
    expect(residentNamePrefill({ full_name: 'Juan Dela Cruz' })).toEqual({ firstName: 'Juan', lastName: 'Dela Cruz' });
  });
  it('accepts the provider name claim when full_name is missing', () => {
    expect(residentNamePrefill({ name: 'Juan Santos' })).toEqual({ firstName: 'Juan', lastName: 'Santos' });
  });
  it('uses the remaining display name after a multiword given name', () => {
    expect(residentNamePrefill({ given_name: 'Mary Ann', full_name: 'Mary Ann de la Cruz' })).toEqual({ firstName: 'Mary Ann', lastName: 'de la Cruz' });
  });
  it('uses the remaining display name before a known family name', () => {
    expect(residentNamePrefill({ family_name: 'de la Cruz', name: 'Mary Ann de la Cruz' })).toEqual({ firstName: 'Mary Ann', lastName: 'de la Cruz' });
  });
  it('preserves names already saved on the resident profile', () => {
    expect(residentNamePrefill({ given_name: 'Provider', family_name: 'Name' }, { first_name: 'Saved', last_name: 'Resident' })).toEqual({ firstName: 'Saved', lastName: 'Resident' });
  });
  it('falls back for blank saved names and normalizes provider whitespace', () => {
    expect(residentNamePrefill({ full_name: '  Juan\tDela  Cruz ' }, { first_name: ' ', last_name: null })).toEqual({ firstName: 'Juan', lastName: 'Dela Cruz' });
  });
  it('does not invent a surname for a single name', () => {
    expect(residentNamePrefill({ name: 'Cher' })).toEqual({ firstName: 'Cher', lastName: '' });
  });
  it('does not guess names from a Gmail address', () => {
    expect(residentNamePrefill({ email: 'juan.santos123@gmail.com' })).toEqual({ firstName: '', lastName: '' });
  });
  it('ignores malformed metadata values and handles absent metadata', () => {
    expect(residentNamePrefill({ given_name: 123, family_name: [], full_name: {}, name: 'Juan Santos' })).toEqual({ firstName: 'Juan', lastName: 'Santos' });
    expect(residentNamePrefill(null)).toEqual({ firstName: '', lastName: '' });
  });
  it('leaves an unknown surname blank when structured and display names disagree', () => {
    expect(residentNamePrefill({ given_name: 'Juan', full_name: 'Other Name' })).toEqual({ firstName: 'Juan', lastName: '' });
  });
});

describe('advisory and constrained map classification', () => {
  const boundary: Polygon = { type:'Polygon', coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]] };
  it.each([[1,1,true],[0,5,true],[10,10,true],[5,5,false],[3,5,true],[11,5,false],[NaN,1,false],[91,1,false]])('classifies (%s,%s)', (lat,lng,inside) => expect(isPointInPolygon({lat:lat as number,lng:lng as number},boundary)).toBe(inside));
  it('handles separate multipolygon regions', () => expect(isPointInPolygon({lat:1,lng:1},{type:'MultiPolygon',coordinates:[boundary.coordinates]})).toBe(true));
});
