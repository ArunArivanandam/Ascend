import {
  adherenceFraction,
  adherenceMultiplier,
  flowMinutes,
  isRated,
  meanDepthTap,
  sessionAltitude,
} from './altitude';
import { addDays } from './dates';
import { mean, sum } from './stats';
import type { AdherenceRecord, DaySummary, LocalDate, Session } from './types';

export interface SeriesInput {
  firstClimbDate: LocalDate;
  /** Number of days to build, starting at day 1. */
  days: number;
  sessions: readonly Session[];
  adherence: readonly AdherenceRecord[];
}

function groupByDate<T extends { localDate: LocalDate }>(items: readonly T[]): Map<LocalDate, T[]> {
  const map = new Map<LocalDate, T[]>();
  for (const item of items) {
    const list = map.get(item.localDate);
    if (list) list.push(item);
    else map.set(item.localDate, [item]);
  }
  return map;
}

export function summariseDay(
  day: number,
  localDate: LocalDate,
  sessions: readonly Session[],
  adherence: readonly AdherenceRecord[],
): DaySummary {
  const fraction = adherenceFraction(adherence);
  const multiplier = adherenceMultiplier(fraction);
  const depthTaps = sessions
    .map((session) => meanDepthTap(session.checkin))
    .filter((tap): tap is number => tap !== null);
  const timesToFlow = sessions
    .map((session) => (session.checkin?.skipped ? null : (session.checkin?.timeToFlowMin ?? null)))
    .filter((minutes): minutes is number => minutes !== null);

  return {
    day,
    localDate,
    altitude: sum(sessions.map((session) => sessionAltitude(session, multiplier))),
    flowMinutes: sum(sessions.map(flowMinutes)),
    sessionCount: sessions.length,
    climbed: sessions.length > 0,
    ratedSessionCount: sessions.filter((session) => isRated(session.checkin)).length,
    meanDepthTap: mean(depthTaps),
    meanTimeToFlowMin: mean(timesToFlow),
    interruptions: sum(sessions.map((session) => session.pauseCount + session.exitCount)),
    chunksDone: sessions.filter((session) => session.checkin?.chunkDone === true).length,
    adherence: fraction,
    adherenceMultiplier: multiplier,
  };
}

/**
 * One summary per calendar day from day 1 to `days`, including days with no climb.
 * Sessions and records outside the window are ignored.
 */
export function buildDailySeries(input: SeriesInput): DaySummary[] {
  const sessionsByDate = groupByDate(input.sessions);
  const adherenceByDate = groupByDate(input.adherence);
  const series: DaySummary[] = [];
  for (let day = 1; day <= input.days; day++) {
    const localDate = addDays(input.firstClimbDate, day - 1);
    series.push(
      summariseDay(
        day,
        localDate,
        sessionsByDate.get(localDate) ?? [],
        adherenceByDate.get(localDate) ?? [],
      ),
    );
  }
  return series;
}

/** Trailing rolling mean; the first days average over however many days exist so far. */
export function rollingMean(values: readonly number[], window: number): number[] {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - window + 1), index + 1);
    return sum(slice) / slice.length;
  });
}

export function cumulative(values: readonly number[]): number[] {
  let running = 0;
  return values.map((value) => (running += value));
}
