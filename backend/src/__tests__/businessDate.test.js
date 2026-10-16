const { todayInZone, addDaysKey, isValidTimeZone, resolveTimeZone } = require('../utils/businessDate');

// Business-local calendar dates (WEB_PORTAL.md "Time zones").
describe('businessDate', () => {
  it('returns the Central date in the 7pm–midnight window when UTC is already tomorrow', () => {
    expect(todayInZone('America/Chicago', new Date('2026-10-15T00:30:00Z'))).toBe('2026-10-14'); // 7:30pm CDT
    expect(todayInZone('America/Chicago', new Date('2026-10-15T04:59:00Z'))).toBe('2026-10-14'); // 11:59pm CDT
    expect(todayInZone('America/Chicago', new Date('2026-10-15T05:00:00Z'))).toBe('2026-10-15'); // midnight CDT
  });

  it('handles the month-end evening and CST (UTC-6) after DST ends', () => {
    expect(todayInZone('America/Chicago', new Date('2026-11-01T04:30:00Z'))).toBe('2026-10-31'); // 11:30pm CDT Oct 31
    expect(todayInZone('America/Chicago', new Date('2026-12-01T05:30:00Z'))).toBe('2026-11-30'); // 11:30pm CST Nov 30
    expect(todayInZone('America/Chicago', new Date('2026-12-01T06:00:00Z'))).toBe('2026-12-01');
  });

  it('falls back to America/Chicago for a missing or invalid zone', () => {
    const now = new Date('2026-10-15T02:00:00Z');
    expect(todayInZone(null, now)).toBe('2026-10-14');
    expect(todayInZone('Not/AZone', now)).toBe('2026-10-14');
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(resolveTimeZone('')).toBe('America/Chicago');
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDaysKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysKey('2026-11-01', 1)).toBe('2026-11-02'); // DST ends Nov 1
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});
