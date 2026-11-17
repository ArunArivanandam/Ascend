import { DRIVER_MIN_DAYS } from './constants';
import { mean, sum } from './stats';
import type { AdherenceRecord, DaySummary, RoutineItem } from './types';

export interface DriverInsight {
  item: RoutineItem;
  daysHonoured: number;
  daysNotHonoured: number;
  altitudeHonoured: number;
  altitudeNotHonoured: number;
  /** Mean depth tap on days with / without the item; null when no rated sessions. */
  depthHonoured: number | null;
  depthNotHonoured: number | null;
  /** depthHonoured − depthNotHonoured; null when either side has no depth. */
  depthDelta: number | null;
  /** altitudeHonoured − altitudeNotHonoured. */
  altitudeDelta: number;
}

function meanDepth(days: readonly DaySummary[]): number | null {
  return mean(days.map((day) => day.meanDepthTap).filter((tap): tap is number => tap !== null));
}

/** Callers guarantee at least DRIVER_MIN_DAYS days. */
function meanAltitude(days: readonly DaySummary[]): number {
  return sum(days.map((day) => day.altitude)) / days.length;
}

function depthMagnitude(insight: DriverInsight): number {
  return insight.depthDelta === null ? 0 : Math.abs(insight.depthDelta);
}

/**
 * For each routine item, compares climbing days on which it was honoured against
 * climbing days on which it was not. An item counts as honoured on a day only if
 * every record for it that day is honoured. Items with fewer than DRIVER_MIN_DAYS on
 * either side are left out. Results are associations, never causes.
 *
 * Altitude already includes the adherence multiplier A, so honoured days get a
 * mechanical boost. Rankings therefore use depthDelta, which A does not touch.
 */
export function driverInsights(
  series: readonly DaySummary[],
  adherence: readonly AdherenceRecord[],
  items: readonly RoutineItem[],
): DriverInsight[] {
  const climbedByDate = new Map<string, DaySummary>();
  for (const day of series) if (day.climbed) climbedByDate.set(day.localDate, day);

  const insights: DriverInsight[] = [];
  for (const item of items) {
    const byDate = new Map<string, { day: DaySummary; honoured: boolean }>();
    for (const record of adherence) {
      if (record.itemId !== item.id) continue;
      const day = climbedByDate.get(record.localDate);
      if (!day) continue;
      const entry = byDate.get(record.localDate);
      if (entry) entry.honoured = entry.honoured && record.honoured;
      else byDate.set(record.localDate, { day, honoured: record.honoured });
    }

    const withItem: DaySummary[] = [];
    const withoutItem: DaySummary[] = [];
    for (const { day, honoured } of byDate.values()) {
      (honoured ? withItem : withoutItem).push(day);
    }
    if (withItem.length < DRIVER_MIN_DAYS || withoutItem.length < DRIVER_MIN_DAYS) continue;

    const altitudeHonoured = meanAltitude(withItem);
    const altitudeNotHonoured = meanAltitude(withoutItem);
    const depthHonoured = meanDepth(withItem);
    const depthNotHonoured = meanDepth(withoutItem);

    insights.push({
      item,
      daysHonoured: withItem.length,
      daysNotHonoured: withoutItem.length,
      altitudeHonoured,
      altitudeNotHonoured,
      depthHonoured,
      depthNotHonoured,
      depthDelta:
        depthHonoured !== null && depthNotHonoured !== null
          ? depthHonoured - depthNotHonoured
          : null,
      altitudeDelta: altitudeHonoured - altitudeNotHonoured,
    });
  }

  return insights.sort((a, b) => depthMagnitude(b) - depthMagnitude(a));
}

/**
 * The item most associated with weak sessions: not honouring it goes with the
 * largest drop in depth. Null when no item shows a positive association.
 */
export function itemMostAssociatedWithWeakSessions(
  insights: readonly DriverInsight[],
): DriverInsight | null {
  let best: DriverInsight | null = null;
  let bestDelta = 0;
  for (const insight of insights) {
    if (insight.depthDelta !== null && insight.depthDelta > bestDelta) {
      best = insight;
      bestDelta = insight.depthDelta;
    }
  }
  return best;
}

/** Keep items associated with deeper sessions; reconsider items associated with shallower ones. */
export function keepOrDrop(insights: readonly DriverInsight[]): {
  keep: RoutineItem[];
  drop: RoutineItem[];
} {
  const keep: RoutineItem[] = [];
  const drop: RoutineItem[] = [];
  for (const insight of insights) {
    if (insight.depthDelta === null || insight.depthDelta === 0) continue;
    (insight.depthDelta > 0 ? keep : drop).push(insight.item);
  }
  return { keep, drop };
}
