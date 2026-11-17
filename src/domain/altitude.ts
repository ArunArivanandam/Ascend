import {
  ADHERENCE_MULTIPLIER_MAX,
  ADHERENCE_MULTIPLIER_MIN,
  DEPTH_MULTIPLIER_MAX,
  DEPTH_MULTIPLIER_MIN,
  NEUTRAL_MULTIPLIER,
  TAP_MAX,
  TAP_MIN,
} from './constants';
import { lerpClamped, mean } from './stats';
import type { AdherenceRecord, Checkin, DepthTap, RoutineKind, Session } from './types';

export interface RatedCheckin extends Checkin {
  skipped: false;
  focus: DepthTap;
  challengeSkill: DepthTap;
  timePassing: DepthTap;
}

/** True when the check-in has all three depth taps. Skipped check-ins never count. */
export function isRated(checkin: Checkin | null): checkin is RatedCheckin {
  return (
    checkin !== null &&
    !checkin.skipped &&
    checkin.focus !== null &&
    checkin.challengeSkill !== null &&
    checkin.timePassing !== null
  );
}

/** Mean of the three depth taps, or null when the check-in is not rated. */
export function meanDepthTap(checkin: Checkin | null): number | null {
  if (!isRated(checkin)) return null;
  return (checkin.focus + checkin.challengeSkill + checkin.timePassing) / 3;
}

/** D: 0.5 (all 1s) to 1.5 (all 5s); neutral 1.0 when the check-in is skipped. */
export function depthMultiplier(checkin: Checkin | null): number {
  const tap = meanDepthTap(checkin);
  if (tap === null) return NEUTRAL_MULTIPLIER;
  return lerpClamped(tap, TAP_MIN, TAP_MAX, DEPTH_MULTIPLIER_MIN, DEPTH_MULTIPLIER_MAX);
}

/**
 * Daily adherence: the mean of Add adherence and Subtract adherence, using only
 * the lists that have records that day. Null when there are no records at all.
 */
export function adherenceFraction(records: readonly AdherenceRecord[]): number | null {
  const kinds: RoutineKind[] = ['add', 'subtract'];
  const parts: number[] = [];
  for (const kind of kinds) {
    const ofKind = records.filter((record) => record.kind === kind);
    if (ofKind.length > 0) {
      parts.push(ofKind.filter((record) => record.honoured).length / ofKind.length);
    }
  }
  return mean(parts);
}

/** A: 0.8 at 0% adherence to 1.2 at 100%; neutral 1.0 when there is no adherence data. */
export function adherenceMultiplier(fraction: number | null): number {
  if (fraction === null) return NEUTRAL_MULTIPLIER;
  return lerpClamped(fraction, 0, 1, ADHERENCE_MULTIPLIER_MIN, ADHERENCE_MULTIPLIER_MAX);
}

export function flowMinutes(session: Session): number {
  return Math.max(0, session.flowSeconds) / 60;
}

/** FlowMinutes × D × A for one session. No streak or bonus terms, ever. */
export function sessionAltitude(session: Session, dayAdherenceMultiplier: number): number {
  return flowMinutes(session) * depthMultiplier(session.checkin) * dayAdherenceMultiplier;
}
