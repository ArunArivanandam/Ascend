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
