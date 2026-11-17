/** A calendar date in the user's local timezone, formatted YYYY-MM-DD. */
export type LocalDate = string;

export type DepthTap = 1 | 2 | 3 | 4 | 5;

export interface Checkin {
  skipped: boolean;
  /** "How focused were you?" */
  focus: DepthTap | null;
  /** "Did the challenge match your skill?" */
  challengeSkill: DepthTap | null;
  /** "Did time pass quickly?" */
  timePassing: DepthTap | null;
  /** Minutes until the user felt in the zone. */
  timeToFlowMin: number | null;
  chunkDone: boolean;
}

/** A completed climb. A session belongs to the local date on which it started. */
export interface Session {
  id: string;
  localDate: LocalDate;
  /** Timer time minus pauses and app exits. */
  flowSeconds: number;
  pauseCount: number;
  exitCount: number;
  /** null when the check-in was never shown or answered; treated like a skip. */
  checkin: Checkin | null;
}

export type RoutineKind = 'add' | 'subtract';

export interface RoutineItem {
  id: string;
  kind: RoutineKind;
  label: string;
}

/**
 * Whether one Add item was ticked or one Subtract item was honoured. There may be
 * several records per item per day (one per climb); see `adherenceFraction`.
 */
export interface AdherenceRecord {
  localDate: LocalDate;
  itemId: string;
  kind: RoutineKind;
  honoured: boolean;
}

/** One day of the report window, computed from sessions and adherence records. */
export interface DaySummary {
  /** 1-based day number; day 1 is the date of the first climb. */
  day: number;
  localDate: LocalDate;
  altitude: number;
  flowMinutes: number;
  sessionCount: number;
  climbed: boolean;
  /** Sessions with all three depth taps answered. */
  ratedSessionCount: number;
  /** Mean of the three depth taps across rated sessions; null when none were rated. */
  meanDepthTap: number | null;
  meanTimeToFlowMin: number | null;
  /** Pauses plus app exits. */
  interruptions: number;
  chunksDone: number;
  /** Combined Add/Subtract adherence (0–1); null when there were no records. */
  adherence: number | null;
  adherenceMultiplier: number;
}
