import { describe, expect, it } from 'vitest';
import { normalizeBirthDate, parseIdText } from '../../../../supabase/functions/extract-resident-id/id-text';
import { idPhotoBytes } from './id-photo-bytes';

describe('native camera bytes', () => {
  it.each(['AQID', '/9g=', '/w=='])('decodes camera bytes with or without padding (%s)', value => {
    expect(idPhotoBytes(value)).toEqual(new Uint8Array(Buffer.from(value, 'base64')));
  });
  it('rejects invalid and oversized captures', () => {
    expect(() => idPhotoBytes('invalid')).toThrow();
    expect(() => idPhotoBytes('A'.repeat(6990512))).toThrow('5 MB');
  });
});

describe('front ID text extraction', () => {
  it('reads bilingual PhilSys fields without substituting profile values', () => {
    expect(parseIdText('Apelyido/Last Name\nREYES\nMga Pangalan/Given Names\nANA MARIA\nGitnang Apelyido/Middle Name\nCRUZ\nPetsa ng Kapanganakan/Date of Birth\nJUNE 12, 1990\nTirahan/Address\n12 MAIN STREET\nSAN MATEO RIZAL\nSex\nFEMALE\n1234-5678-9012-3456')).toEqual({
      fullName: 'ANA MARIA CRUZ REYES', idNumber: '1234-5678-9012-3456', birthDate: '1990-06-12', address: '12 MAIN STREET SAN MATEO RIZAL',
    });
  });
  it('reads a combined license name label and inline fields', () => {
    expect(parseIdText('Last Name, First Name, Middle Name\nREYES, ANA, CRUZ\nLicense No. N01-12-345678\nDate of Birth: 1990/06/12')).toEqual({ fullName: 'REYES, ANA, CRUZ', idNumber: 'N01-12-345678', birthDate: '1990-06-12', address: '' });
  });
  it('does not fill a missing field from the next label or expiration date', () => {
    expect(parseIdText('Full Name\nID Number: 12345\nExpiry: 2030/01/01')).toEqual({ fullName: '', idNumber: '12345', birthDate: '', address: '' });
  });
  it.each(['2001-02-29', '2020-13-01', '0000-01-01', 'January 1, 2999', 'unknown'])('rejects invalid or future birth date %s', value => expect(normalizeBirthDate(value)).toBe(''));
  it.each(['2000-02-29', '02/29/2000', '29 February 2000', 'FEBRUARY 29, 2000'])('normalizes %s to a real calendar date', value => expect(normalizeBirthDate(value)).toBe('2000-02-29'));
});

