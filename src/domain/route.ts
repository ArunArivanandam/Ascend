import { daysBetween } from './dates';
import type { LocalDate } from './types';

export interface RouteChunk {
  campIndex: number;
  done: boolean;
}

export interface RoutePosition {
  /** 0 at base, 1 at the summit, by share of chunks done. */
  progress: number;
  /** Progress at the end of the last camp whose chunks are all done. */
  lastCampProgress: number;
  /** Where to draw the avatar today. */
  avatarProgress: number;
  missedDay: boolean;
}

/**
 * Avatar position on the route. After a missed day (no climb yesterday and none yet
 * today) the avatar is drawn at the last camp reached. If no camp has been reached
 * yet it stays where it is: a missed day never sends it back to zero. Progress itself
 * is never removed.
 */
export function routePosition(
  chunks: readonly RouteChunk[],
  lastClimbDate: LocalDate | null,
  today: LocalDate,
): RoutePosition {
  const total = chunks.length;
  if (total === 0) {
    return { progress: 0, lastCampProgress: 0, avatarProgress: 0, missedDay: false };
  }
  const progress = chunks.filter((chunk) => chunk.done).length / total;

  const campIndexes = [...new Set(chunks.map((chunk) => chunk.campIndex))].sort((a, b) => a - b);
  let chunksThroughLastCamp = 0;
  for (const campIndex of campIndexes) {
    const inCamp = chunks.filter((chunk) => chunk.campIndex === campIndex);
    if (!inCamp.every((chunk) => chunk.done)) break;
    chunksThroughLastCamp += inCamp.length;
  }
  const lastCampProgress = chunksThroughLastCamp / total;

  const missedDay = lastClimbDate !== null && daysBetween(lastClimbDate, today) >= 2;
  return {
    progress,
    lastCampProgress,
    avatarProgress: missedDay && lastCampProgress > 0 ? lastCampProgress : progress,
    missedDay,
  };
}
