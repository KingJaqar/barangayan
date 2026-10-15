import { describe, expect, it } from 'vitest';
import { birthdayIso, birthdayParts, daysInBirthdayMonth, limitBirthday } from './birthday-wheel';

const today = new Date(2026, 9, 14);
describe('birthday wheel calendar values', () => {
  it('starts from the extracted date and retains its exact ISO value', () => {
    expect(birthdayIso(birthdayParts('2000-02-29', today))).toBe('2000-02-29');
  });
  it('uses an uncommitted default for a missing birthday', () => {
    expect(birthdayParts('', today)).toEqual({ year: 2008, month: 1, day: 1 });
  });
  it('clamps leap day after changing to a non-leap year', () => {
    expect(limitBirthday({ year: 2001, month: 2, day: 29 }, today)).toEqual({ year: 2001, month: 2, day: 28 });
  });
  it('clamps a 31st when changing to a shorter month', () => {
    expect(limitBirthday({ year: 2000, month: 4, day: 31 }, today)).toEqual({ year: 2000, month: 4, day: 30 });
  });
  it('does not allow a future birthday', () => {
    expect(limitBirthday({ year: 2027, month: 12, day: 31 }, today)).toEqual({ year: 2026, month: 10, day: 14 });
  });
  it('handles Gregorian leap-year boundaries', () => {
    expect(daysInBirthdayMonth(1900, 2)).toBe(28);
    expect(daysInBirthdayMonth(2000, 2)).toBe(29);
  });
});
