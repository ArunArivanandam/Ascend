import { REMINDER_DAYS_AHEAD } from '../constants';
import { localMinutesOfDay, localTimeToInstant } from '../dates';
import { estimateAccuracy } from '../estimates';
import {
  formatReminderTime,
  parseReminderTime,
  planReminders,
  shiftReminderTime,
} from '../reminders';

describe('reminder time', () => {
  it('parses and formats HH:MM', () => {
    expect(parseReminderTime('09:05')).toEqual({ hour: 9, minute: 5 });
    expect(formatReminderTime({ hour: 9, minute: 5 })).toBe('09:05');
    expect(formatReminderTime({ hour: 21, minute: 30 })).toBe('21:30');
  });

  it('rejects anything that is not a valid time', () => {
    for (const bad of [null, undefined, '', '9:05', '24:00', '12:60', 'noon']) {
      expect(parseReminderTime(bad)).toBeNull();
    }
  });

  it('shifts across midnight in both directions', () => {
    expect(shiftReminderTime({ hour: 9, minute: 0 }, 15)).toEqual({ hour: 9, minute: 15 });
    expect(shiftReminderTime({ hour: 23, minute: 30 }, 60)).toEqual({ hour: 0, minute: 30 });
    expect(shiftReminderTime({ hour: 0, minute: 10 }, -15)).toEqual({ hour: 23, minute: 55 });
  });
});

describe('planReminders', () => {
  const base = { today: '2026-11-17', time: { hour: 9, minute: 0 }, climbedToday: false };

  it('plans nothing when reminders are off', () => {
    expect(planReminders({ ...base, time: null, minutesNow: 0 })).toEqual([]);
  });

  it('includes today when the time is still ahead and there was no climb yet', () => {
    const slots = planReminders({ ...base, minutesNow: 8 * 60 });
    expect(slots).toHaveLength(REMINDER_DAYS_AHEAD + 1);
    expect(slots[0]).toEqual({ localDate: '2026-11-17', hour: 9, minute: 0 });
    expect(slots[1]?.localDate).toBe('2026-11-18');
    expect(slots.at(-1)?.localDate).toBe('2026-12-01');
  });

  it('skips today once the user has climbed', () => {
    const slots = planReminders({ ...base, minutesNow: 8 * 60, climbedToday: true });
    expect(slots).toHaveLength(REMINDER_DAYS_AHEAD);
    expect(slots[0]?.localDate).toBe('2026-11-18');
  });

  it('skips today when the reminder time has passed or is right now', () => {
    expect(planReminders({ ...base, minutesNow: 9 * 60 })[0]?.localDate).toBe('2026-11-18');
    expect(planReminders({ ...base, minutesNow: 20 * 60 })[0]?.localDate).toBe('2026-11-18');
  });
});

describe('timezone-aware wall-clock helpers', () => {
  it('reads the minutes of the day in a timezone', () => {
    const instant = Date.UTC(2026, 10, 17, 4, 0); // 09:30 in India, 23:00 the day before in New York
    expect(localMinutesOfDay(instant, 'Asia/Kolkata')).toBe(9 * 60 + 30);
    expect(localMinutesOfDay(instant, 'America/New_York')).toBe(23 * 60);
    expect(localMinutesOfDay(Date.UTC(2026, 10, 17, 18, 30), 'Asia/Kolkata')).toBe(0);
  });

  it('converts a local date and time to an instant', () => {
    expect(localTimeToInstant('2026-11-17', 9, 0, 'Asia/Kolkata')).toBe(
      Date.UTC(2026, 10, 17, 3, 30),
    );
    expect(localTimeToInstant('2026-07-01', 9, 0, 'America/New_York')).toBe(
      Date.UTC(2026, 6, 1, 13, 0),
    );
  });

  it('gets the hour right on the day daylight saving ends', () => {
    // New York falls back at 06:00 UTC on 1 Nov 2026; 03:00 local is then 08:00 UTC.
    expect(localTimeToInstant('2026-11-01', 3, 0, 'America/New_York')).toBe(
      Date.UTC(2026, 10, 1, 8, 0),
    );
    expect(localTimeToInstant('2026-11-01', 9, 0, 'America/New_York')).toBe(
      Date.UTC(2026, 10, 1, 14, 0),
    );
  });
});

describe('estimateAccuracy', () => {
  it('compares planned and actual minutes', () => {
    expect(estimateAccuracy(60, 75 * 60)).toEqual({ estimateMin: 60, actualMin: 75, ratio: 1.25 });
  });

  it('is null without an estimate or without focus time', () => {
    expect(estimateAccuracy(null, 600)).toBeNull();
    expect(estimateAccuracy(0, 600)).toBeNull();
    expect(estimateAccuracy(30, 0)).toBeNull();
  });
});
