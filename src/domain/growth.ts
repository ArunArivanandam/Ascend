import {
  BASELINE_WEEK,
  COMPARISON_WEEK,
  GROWTH_EXPONENT_DAYS,
  MIN_CLIMBING_DAYS_PER_WEEK,
  PLATEAU_BAND,
  WEEK_LENGTH,
} from './constants';
import { sum } from './stats';
import type { DaySummary } from './types';

/** The days of a 1-based week. Missing days (series too short) are simply absent. */
export function weekDays(series: readonly DaySummary[], week: number): DaySummary[] {
  const first = (week - 1) * WEEK_LENGTH + 1;
  const last = week * WEEK_LENGTH;
  return series.filter((day) => day.day >= first && day.day <= last);
}

/** Mean daily altitude over all 7 calendar days of a week; missed days count as 0. */
export function weekAverageAltitude(series: readonly DaySummary[], week: number): number {
  return sum(weekDays(series, week).map((day) => day.altitude)) / WEEK_LENGTH;
}

export function climbingDays(days: readonly DaySummary[]): number {
  return days.filter((day) => day.climbed).length;
}

export type GrowthResult =
  | { status: 'ok'; g: number; week1Average: number; week4Average: number }
  | {
      status: 'insufficient_data';
      week1ClimbingDays: number;
      week4ClimbingDays: number;
      week1Average: number;
      week4Average: number;
    };

/**
 * g = (avg altitude week 4 / avg altitude week 1)^(1/21) − 1.
 * Needs ≥4 climbing days in both weeks and a positive week-1 average.
 */
export function computeGrowth(series: readonly DaySummary[]): GrowthResult {
  const week1Average = weekAverageAltitude(series, BASELINE_WEEK);
  const week4Average = weekAverageAltitude(series, COMPARISON_WEEK);
  const week1ClimbingDays = climbingDays(weekDays(series, BASELINE_WEEK));
  const week4ClimbingDays = climbingDays(weekDays(series, COMPARISON_WEEK));

  if (
    week1ClimbingDays < MIN_CLIMBING_DAYS_PER_WEEK ||
    week4ClimbingDays < MIN_CLIMBING_DAYS_PER_WEEK ||
    week1Average <= 0
  ) {
    return {
      status: 'insufficient_data',
      week1ClimbingDays,
      week4ClimbingDays,
      week1Average,
      week4Average,
    };
  }

  const g = Math.pow(week4Average / week1Average, 1 / GROWTH_EXPONENT_DAYS) - 1;
  return { status: 'ok', g, week1Average, week4Average };
}

export type GrowthOutcome = 'growth' | 'plateau' | 'decline';

export function classifyGrowth(g: number): GrowthOutcome {
  if (g > PLATEAU_BAND) return 'growth';
  if (g < -PLATEAU_BAND) return 'decline';
  return 'plateau';
}

/** Week-1 average altitude projected across `days` days, as a cumulative line. */
export function flatPath(week1Average: number, days: number): number[] {
  return Array.from({ length: days }, (_, index) => week1Average * (index + 1));
}

/**
 * Projected total altitude over the `days` days after the report if growth continues at g.
 * Growth is compounded from the midpoint of week 4 (day 25).
 */
export function projectAltitude(
  week4Average: number,
  g: number,
  reportDays: number,
  days: number,
): number {
  const week4Midpoint = (COMPARISON_WEEK - 1) * WEEK_LENGTH + Math.ceil(WEEK_LENGTH / 2);
  const offset = reportDays - week4Midpoint;
  let total = 0;
  for (let n = 1; n <= days; n++) total += week4Average * Math.pow(1 + g, offset + n);
  return total;
}
