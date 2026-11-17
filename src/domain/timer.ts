import { MAX_SESSION_SECONDS, MIN_SESSION_SECONDS } from './constants';
import { clamp } from './stats';

export interface TimerEvent {
  kind: 'pause' | 'exit';
  /** Epoch milliseconds. */
  startedAt: number;
  /** Null while the pause or exit is still open. */
  endedAt: number | null;
}

export interface TimerState {
  startedAt: number;
  /** Null while the climb is running. */
  endedAt: number | null;
  events: readonly TimerEvent[];
}

/**
 * Flow seconds at `nowMs`, computed from timestamps only (never from ticks), so the
 * result survives the app being backgrounded or killed.
 *
 * Pauses are subtracted. App exits are counted as interruptions but NOT subtracted:
 * JavaScript cannot tell "locked the phone and worked" from "switched to another app"
 * (PLAN.md §2). The result is capped at MAX_SESSION_SECONDS.
 */
export function flowSecondsAt(timer: TimerState, nowMs: number): number {
  const end = Math.max(timer.startedAt, timer.endedAt ?? nowMs);
  let pausedMs = 0;
  for (const event of timer.events) {
    if (event.kind !== 'pause') continue;
    const from = clamp(event.startedAt, timer.startedAt, end);
    const to = clamp(event.endedAt ?? end, timer.startedAt, end);
    pausedMs += Math.max(0, to - from);
  }
  const seconds = Math.floor((end - timer.startedAt - pausedMs) / 1000);
  return clamp(seconds, 0, MAX_SESSION_SECONDS);
}

export function isPaused(timer: TimerState): boolean {
  return timer.events.some((event) => event.kind === 'pause' && event.endedAt === null);
}

export function countEvents(timer: TimerState, kind: TimerEvent['kind']): number {
  return timer.events.filter((event) => event.kind === kind).length;
}

/** True when a climb is too short to count as a session. */
export function isTooShort(flowSeconds: number): boolean {
  return flowSeconds < MIN_SESSION_SECONDS;
}

/** "m:ss" under an hour, "h:mm:ss" from an hour up. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
