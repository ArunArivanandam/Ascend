import { addDays, dayNumber, daysBetween, isLocalDate, toLocalDate } from '../dates';

describe('local date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('is unaffected by daylight-saving changes', () => {
    // US DST ends 2026-11-01 and EU DST ends 2026-10-25.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('numbers the first-climb date as day 1', () => {
    expect(dayNumber('2026-11-01', '2026-11-01')).toBe(1);
    expect(dayNumber('2026-11-01', '2026-11-30')).toBe(30);
    expect(daysBetween('2026-11-10', '2026-11-01')).toBe(-9);
  });

  it('rejects malformed or impossible dates', () => {
    expect(isLocalDate('2026-11-01')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-1-1')).toBe(false);
    expect(() => addDays('nope', 1)).toThrow('Invalid local date');
  });
});

describe('toLocalDate', () => {
  it('uses the user timezone, not UTC', () => {
    // 20:00 UTC on 1 Nov is already 2 Nov in India (UTC+5:30)…
    const instant = new Date('2026-11-01T20:00:00Z');
    expect(toLocalDate(instant, 'Asia/Kolkata')).toBe('2026-11-02');
    // …but still 1 Nov in New York.
    expect(toLocalDate(instant, 'America/New_York')).toBe('2026-11-01');
  });
});
