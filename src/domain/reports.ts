import { flowMinutes, isRated, meanDepthTap, sessionAltitude } from './altitude';
import {
  BASELINE_WEEK,
  COMPARISON_WEEK,
  MIN_CLIMBING_DAYS_PER_WEEK,
  MINI_REPORT_DAYS,
  MODEL_VERSION,
  REPORT_DAYS,
  ROLLING_WINDOW_DAYS,
  SUGGESTION_HIGH_INTERRUPTIONS_PER_SESSION,
  SUGGESTION_MIN_CHECKIN_RATE,
  SUGGESTION_SLOW_TIME_TO_FLOW_MIN,
} from './constants';
import {
  classifyGrowth,
  climbingDays,
  computeGrowth,
  flatPath,
  projectAltitude,
  weekDays,
  type GrowthResult,
} from './growth';
import {
  driverInsights,
  itemMostAssociatedWithWeakSessions,
  keepOrDrop,
  type DriverInsight,
} from './insights';
import { buildDailySeries, cumulative, rollingMean } from './series';
import { mean, sum } from './stats';
import type { AdherenceRecord, DaySummary, LocalDate, RoutineItem, Session } from './types';

export interface ReportInput {
  firstClimbDate: LocalDate;
  sessions: readonly Session[];
  adherence: readonly AdherenceRecord[];
  items: readonly RoutineItem[];
}

function sessionsIn(days: readonly DaySummary[], sessions: readonly Session[]): Session[] {
  const dates = new Set(days.map((day) => day.localDate));
  return sessions.filter((session) => dates.has(session.localDate));
}

function timeToFlowValues(sessions: readonly Session[]): number[] {
  return sessions
    .map((session) => (session.checkin?.skipped ? null : (session.checkin?.timeToFlowMin ?? null)))
    .filter((minutes): minutes is number => minutes !== null);
}

// ---------------------------------------------------------------------------
// 7-day mini report
// ---------------------------------------------------------------------------

/** Rule-based week-2 suggestion. The UI maps each code to copy. */
export type SuggestionCode =
  | 'climb_more_days'
  | 'complete_checkins'
  | 'reduce_interruptions'
  | 'add_warmup_item'
  | 'keep_routine';

export interface BestSession {
  session: Session;
  altitude: number;
  /** Add items honoured on that day: "what preceded it". */
  precededBy: RoutineItem[];
}

export interface MiniReport {
  modelVersion: number;
  days: DaySummary[];
  totalAltitude: number;
  totalFlowMinutes: number;
  climbingDays: number;
  bestSession: BestSession | null;
  averageTimeToFlowMin: number | null;
  suggestion: SuggestionCode;
}

function pickSuggestion(days: readonly DaySummary[], sessions: readonly Session[]): SuggestionCode {
  if (sessions.length === 0 || climbingDays(days) < MIN_CLIMBING_DAYS_PER_WEEK) {
    return 'climb_more_days';
  }
  const ratedRate = sessions.filter((session) => isRated(session.checkin)).length / sessions.length;
  if (ratedRate < SUGGESTION_MIN_CHECKIN_RATE) return 'complete_checkins';
  const interruptions = sum(days.map((day) => day.interruptions)) / sessions.length;
  if (interruptions >= SUGGESTION_HIGH_INTERRUPTIONS_PER_SESSION) return 'reduce_interruptions';
  const timeToFlow = mean(timeToFlowValues(sessions));
  if (timeToFlow !== null && timeToFlow >= SUGGESTION_SLOW_TIME_TO_FLOW_MIN) {
    return 'add_warmup_item';
  }
  return 'keep_routine';
}

export function buildMiniReport(input: ReportInput): MiniReport {
  const days = buildDailySeries({ ...input, days: MINI_REPORT_DAYS });
  const sessions = sessionsIn(days, input.sessions);

  let bestSession: BestSession | null = null;
  for (const day of days) {
    for (const session of sessions.filter((s) => s.localDate === day.localDate)) {
      const altitude = sessionAltitude(session, day.adherenceMultiplier);
      if (bestSession === null || altitude > bestSession.altitude) {
        bestSession = { session, altitude, precededBy: [] };
      }
    }
  }
  if (bestSession !== null) {
    const bestDate = bestSession.session.localDate;
    const honouredIds = new Set(
      input.adherence
        .filter((r) => r.localDate === bestDate && r.kind === 'add' && r.honoured)
        .map((r) => r.itemId),
    );
    bestSession.precededBy = input.items.filter((item) => honouredIds.has(item.id));
  }

  return {
    modelVersion: MODEL_VERSION,
    days,
    totalAltitude: sum(days.map((day) => day.altitude)),
    totalFlowMinutes: sum(days.map((day) => day.flowMinutes)),
    climbingDays: climbingDays(days),
    bestSession,
    averageTimeToFlowMin: mean(timeToFlowValues(sessions)),
    suggestion: pickSuggestion(days, sessions),
  };
}

// ---------------------------------------------------------------------------
// 30-day compounding report
// ---------------------------------------------------------------------------

export type ReportOutcome = 'growth' | 'plateau' | 'decline' | 'insufficient_data';

export interface WeekTrend {
  week: number;
  climbingDays: number;
  flowMinutes: number;
  meanDepthTap: number | null;
  meanTimeToFlowMin: number | null;
  /** Chunks completed per focus hour. */
  velocity: number | null;
  interruptionsPerSession: number | null;
}

export type SignalMetric = 'flowMinutes' | 'depth' | 'timeToFlow' | 'velocity' | 'interruptions';

export interface PositiveSignal {
  metric: SignalMetric;
  week1: number;
  week4: number;
  /** Relative improvement, already signed so that positive is better (0.2 = 20% better). */
  relativeImprovement: number;
}

export interface CompoundingReport {
  modelVersion: number;
  series: DaySummary[];
  outcome: ReportOutcome;
  growth: GrowthResult;
  totalAltitude: number;
  actualCumulative: number[];
  flatPath: number[];
  /** Actual cumulative altitude minus the flat path on the last day. */
  compoundingGap: number;
  rollingAltitude: number[];
  trends: WeekTrend[];
  strongestPositiveSignal: PositiveSignal | null;
  drivers: DriverInsight[];
  /** For plateau and decline: the one item most associated with weak sessions. */
  itemToChange: DriverInsight | null;
  nextThirtyDays: {
    keep: RoutineItem[];
    drop: RoutineItem[];
    /** Null when there is no growth rate to project with. */
    projectedAltitude: number | null;
  };
}

export function weekTrend(
  series: readonly DaySummary[],
  sessions: readonly Session[],
  week: number,
): WeekTrend {
  const days = weekDays(series, week);
  const weekSessions = sessionsIn(days, sessions);
  const minutes = sum(weekSessions.map(flowMinutes));
  const chunksDone = weekSessions.filter((s) => s.checkin?.chunkDone === true).length;
  const depths = weekSessions
    .map((session) => meanDepthTap(session.checkin))
    .filter((tap): tap is number => tap !== null);
  const interruptions = sum(weekSessions.map((s) => s.pauseCount + s.exitCount));

  return {
    week,
    climbingDays: climbingDays(days),
    flowMinutes: minutes,
    meanDepthTap: mean(depths),
    meanTimeToFlowMin: mean(timeToFlowValues(weekSessions)),
    velocity: minutes > 0 ? chunksDone / (minutes / 60) : null,
    interruptionsPerSession: weekSessions.length > 0 ? interruptions / weekSessions.length : null,
  };
}

/** The metric that improved most (relatively) from week 1 to week 4, if any did. */
export function strongestPositiveSignal(week1: WeekTrend, week4: WeekTrend): PositiveSignal | null {
  const candidates: [SignalMetric, number | null, number | null, 'higher' | 'lower'][] = [
    ['flowMinutes', week1.flowMinutes, week4.flowMinutes, 'higher'],
    ['depth', week1.meanDepthTap, week4.meanDepthTap, 'higher'],
    ['timeToFlow', week1.meanTimeToFlowMin, week4.meanTimeToFlowMin, 'lower'],
    ['velocity', week1.velocity, week4.velocity, 'higher'],
    ['interruptions', week1.interruptionsPerSession, week4.interruptionsPerSession, 'lower'],
  ];
  let best: PositiveSignal | null = null;
  for (const [metric, before, after, better] of candidates) {
    if (before === null || after === null || before === 0) continue;
    const change = (after - before) / before;
    const relativeImprovement = better === 'higher' ? change : -change;
    if (
      relativeImprovement > 0 &&
      (best === null || relativeImprovement > best.relativeImprovement)
    ) {
      best = { metric, week1: before, week4: after, relativeImprovement };
    }
  }
  return best;
}

export function buildCompoundingReport(input: ReportInput): CompoundingReport {
  const series = buildDailySeries({ ...input, days: REPORT_DAYS });
  const altitudes = series.map((day) => day.altitude);
  const totalAltitude = sum(altitudes);
  const growth = computeGrowth(series);
  const outcome: ReportOutcome =
    growth.status === 'ok' ? classifyGrowth(growth.g) : 'insufficient_data';

  const actualCumulative = cumulative(altitudes);
  const flat = flatPath(growth.week1Average, REPORT_DAYS);
  const trends = Array.from({ length: COMPARISON_WEEK }, (_, index) =>
    weekTrend(series, input.sessions, index + 1),
  );
  const drivers = driverInsights(series, input.adherence, input.items);

  return {
    modelVersion: MODEL_VERSION,
    series,
    outcome,
    growth,
    totalAltitude,
    actualCumulative,
    flatPath: flat,
    compoundingGap: totalAltitude - growth.week1Average * REPORT_DAYS,
    rollingAltitude: rollingMean(altitudes, ROLLING_WINDOW_DAYS),
    trends,
    strongestPositiveSignal: strongestPositiveSignal(
      trends[BASELINE_WEEK - 1] as WeekTrend,
      trends[COMPARISON_WEEK - 1] as WeekTrend,
    ),
    drivers,
    itemToChange:
      outcome === 'plateau' || outcome === 'decline'
        ? itemMostAssociatedWithWeakSessions(drivers)
        : null,
    nextThirtyDays: {
      ...keepOrDrop(drivers),
      projectedAltitude:
        growth.status === 'ok'
          ? projectAltitude(growth.week4Average, growth.g, REPORT_DAYS, REPORT_DAYS)
          : null,
    },
  };
}
