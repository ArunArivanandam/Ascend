import type { LocalDate } from './types';

const DAY_MS = 86_400_000;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a YYYY-MM-DD string as midnight UTC, so day arithmetic ignores DST. */
function toUtcMs(date: LocalDate): number {
  const match = LOCAL_DATE_RE.exec(date);
  if (!match) throw new Error(`Invalid local date: ${date}`);
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  if (fromUtcMs(ms) !== date) throw new Error(`Invalid local date: ${date}`);
  return ms;
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isLocalDate(value: string): boolean {
  try {
    toUtcMs(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** 1-based day number in the report window: the first-climb date is day 1. */
export function dayNumber(firstClimbDate: LocalDate, date: LocalDate): number {
  return daysBetween(firstClimbDate, date) + 1;
}

/** The calendar date of `instant` in an IANA timezone, e.g. "Asia/Kolkata". */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const byType: Record<string, string> = {};
  for (const part of parts) byType[part.type] = part.value;
  return `${byType.year}-${byType.month}-${byType.day}`;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** The wall-clock date and time of an instant in an IANA timezone. */
function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instantMs));
  const byType: Record<string, string> = {};
  for (const part of parts) byType[part.type] = part.value;
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    // Some engines print midnight as 24 even with the h23 cycle.
    hour: Number(byType.hour) % 24,
    minute: Number(byType.minute),
  };
}

/** Minutes since local midnight (0–1439) at `instantMs` in an IANA timezone. */
export function localMinutesOfDay(instantMs: number, timeZone: string): number {
  const { hour, minute } = zonedParts(instantMs, timeZone);
  return hour * 60 + minute;
}

/** How far the timezone's wall clock is ahead of UTC at `instantMs`, in milliseconds. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return wallClockAsUtc - Math.floor(instantMs / 60_000) * 60_000;
}

/**
 * The instant (epoch milliseconds) at which a timezone's wall clock shows the given
 * local date and time. Handles daylight-saving changes.
 */
export function localTimeToInstant(
  date: LocalDate,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const wallClockAsUtc = toUtcMs(date) + (hour * 60 + minute) * 60_000;
  const firstGuess = wallClockAsUtc - zoneOffsetMs(wallClockAsUtc, timeZone);
  // The offset at the guess can differ from the offset at the answer near a DST change.
  return wallClockAsUtc - zoneOffsetMs(firstGuess, timeZone);
}
