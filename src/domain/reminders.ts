import { REMINDER_DAYS_AHEAD } from './constants';
import { addDays } from './dates';
import type { LocalDate } from './types';

/** A time of day on the user's wall clock. */
export interface ReminderTime {
  hour: number;
  minute: number;
}

export interface ReminderSlot extends ReminderTime {
  localDate: LocalDate;
}

const TIME_RE = /^(\d{2}):(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;

/** Parses "HH:MM" (24-hour). Returns null for anything else. */
export function parseReminderTime(value: string | null | undefined): ReminderTime | null {
  const match = TIME_RE.exec(value ?? '');
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

export function formatReminderTime(time: ReminderTime): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(time.hour)}:${two(time.minute)}`;
}

/** Moves a time by `deltaMinutes`, wrapping around midnight. */
export function shiftReminderTime(time: ReminderTime, deltaMinutes: number): ReminderTime {
  const total = time.hour * 60 + time.minute + deltaMinutes;
  const wrapped = ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60 };
}

/**
 * The climb reminders to schedule, one per day at most. Today is included only if the
 * user has not climbed yet and the reminder time is still ahead. Reminders stop after
 * REMINDER_DAYS_AHEAD days; they are re-planned every time the app is opened.
 */
export function planReminders(input: {
  today: LocalDate;
  /** Minutes since local midnight right now. */
  minutesNow: number;
  time: ReminderTime | null;
  climbedToday: boolean;
}): ReminderSlot[] {
  const { time } = input;
  if (!time) return [];
  const slots: ReminderSlot[] = [];
  const stillAheadToday = time.hour * 60 + time.minute > input.minutesNow;
  if (!input.climbedToday && stillAheadToday) slots.push({ localDate: input.today, ...time });
  for (let offset = 1; offset <= REMINDER_DAYS_AHEAD; offset++) {
    slots.push({ localDate: addDays(input.today, offset), ...time });
  }
  return slots;
}
