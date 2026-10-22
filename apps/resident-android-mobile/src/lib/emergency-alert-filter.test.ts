import { describe, expect, it } from 'vitest';

import { ALERT_MONTHS, ALERT_PERIODS, EMPTY_ALERT_DATE, alertDateLabel, alertYearOptions, matchesEmergencyAlert, type AlertDateFilter, type AlertPeriod } from './emergency-alert-filter';

// Independent copy of the old screen predicate, retained as a behavior oracle.
function previousPredicate(at: string, period: AlertPeriod, filter: AlertDateFilter, now: Date) {
  const date = new Date(at);
  const months: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  const month = filter.month.trim() ? months[filter.month.toLowerCase().trim()] ?? null : null;
  const day = parseInt(filter.day, 10);
  const year = parseInt(filter.year, 10);
  if (month !== null && date.getMonth() + 1 !== month) return false;
  if (!Number.isNaN(day) && date.getDate() !== day) return false;
  if (!Number.isNaN(year) && date.getFullYear() !== year) return false;
  if (period === 'today') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (period !== 'all') {
    const lower = new Date(now);
    lower.setDate(lower.getDate() - (period === 'lastWeek' ? 7 : period === 'lastMonth' ? 30 : 365));
    return date >= lower;
  }
  return true;
}

describe('emergency alert filtering preserves the existing local predicates', () => {
  const now = new Date(2026, 9, 20, 12, 30);
  it('matches the previous screen for period and independent date-part combinations', () => {
    const dates = ['2024-02-29T08:00:00Z', '2026-10-20T00:00:00Z', '2026-09-30T23:59:59Z', '2028-01-01T00:00:00Z', 'invalid'];
    for (const period of ALERT_PERIODS) for (const month of ['', ...ALERT_MONTHS, 'invalid'])
      for (const day of ['', '1', '20', '29', '31', '0', '99']) for (const year of ['', '2024', '2026', '2028', '0001', '300000'])
        for (const at of dates) {
          const filter = { month, day, year };
          expect(matchesEmergencyAlert(at, period.key, filter, now)).toBe(previousPredicate(at, period.key, filter, now));
        }
  });
  it.each([['lastWeek', 7], ['lastMonth', 30], ['lastYear', 365]] as const)('retains inclusive rolling %s lower boundary and existing future-date behavior', (period, days) => {
    const lower = new Date(now);
    lower.setDate(lower.getDate() - days);
    expect(matchesEmergencyAlert(lower.toISOString(), period, EMPTY_ALERT_DATE, now)).toBe(true);
    expect(matchesEmergencyAlert(new Date(lower.getTime() - 1).toISOString(), period, EMPTY_ALERT_DATE, now)).toBe(false);
    expect(matchesEmergencyAlert(new Date(now.getTime() + 86400000).toISOString(), period, EMPTY_ALERT_DATE, now)).toBe(true);
  });
  it('keeps month/day without year, leap-day and impossible combinations independent', () => {
    const leap = new Date(2024, 1, 29, 12).toISOString();
    expect(matchesEmergencyAlert(leap, 'all', { month: 'February', day: '29', year: '' }, now)).toBe(true);
    expect(matchesEmergencyAlert(leap, 'all', { month: 'February', day: '29', year: '2023' }, now)).toBe(false);
    expect(matchesEmergencyAlert(leap, 'all', { month: 'February', day: '31', year: '' }, now)).toBe(false);
    expect(matchesEmergencyAlert(leap, 'lastWeek', { month: 'February', day: '29', year: '' }, now)).toBe(false);
  });
  it('starts in 2026 and adds each year only as the calendar reaches it', () => {
    expect(alertYearOptions(2026)).toEqual(['', '2026']);
    expect(alertYearOptions(2027)).toEqual(['', '2026', '2027']);
    expect(alertYearOptions(2029)).toEqual(['', '2026', '2027', '2028', '2029']);
    expect(alertYearOptions(2025)).toEqual(['', '2026']);
    expect(alertYearOptions()).toEqual(alertYearOptions(new Date().getFullYear()));
  });
  it('labels unset parts without claiming a whole date', () => {
    expect(alertDateLabel({ month: 'February', day: '29', year: '' })).toBe('Feb · 29 · Any year');
    expect(alertDateLabel({ month: '', day: '', year: '2200' })).toBe('Any month · Any day · 2200');
  });
});
