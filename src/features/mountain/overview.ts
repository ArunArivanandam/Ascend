import type { ChunkRow, MountainRow } from '@/db/schema';
import type { Repositories } from '@/db/repositories';
import {
  buildDailySeries,
  dayNumber,
  daysBetween,
  routePosition,
  sum,
  type LocalDate,
  type RouteChunk,
  type RoutePosition,
  type SetupStep,
} from '@/domain';
import { loadSetupPrompt } from '@/features/setup/setup-prompt';

export interface Overview {
  mountain: MountainRow;
  /** A climb that is running or paused right now. */
  activeSessionId: string | null;
  /** A finished climb still waiting for its check-in (for example after an app kill). */
  pendingCheckinSessionId: string | null;
  nextChunk: ChunkRow | null;
  todayAltitude: number;
  totalAltitude: number;
  totalFlowMinutes: number;
  climbCount: number;
  climbedToday: boolean;
  /** Negative once the target date has passed. */
  daysToTarget: number;
  route: RoutePosition;
  /** Route progress (0–1) at which each intermediate camp sits. */
  campMarkers: number[];
  /** How much route progress one chunk is worth. */
  stepSize: number;
  /** True when there is a pre-climb checklist to tick before starting. */
  hasChecklist: boolean;
  /** The one setup card to show today (Add, Subtract or Divide), if any. */
  setupPrompt: SetupStep | null;
}

/** Everything the home screen shows, or null when there is no mountain yet. */
export function loadOverview(repos: Repositories, today: LocalDate): Overview | null {
  const mountain = repos.mountains.getActive();
  if (!mountain) return null;

  const chunks = repos.chunks.list(mountain.id);
  const sessions = repos.stats.domainSessions(mountain.id);
  const lastSession = sessions.at(-1);

  let todayAltitude = 0;
  let totalAltitude = 0;
  const firstDate = sessions[0]?.localDate;
  if (firstDate) {
    const lastDate = lastSession && lastSession.localDate > today ? lastSession.localDate : today;
    const series = buildDailySeries({
      firstClimbDate: firstDate,
      days: Math.max(1, daysBetween(firstDate, lastDate) + 1),
      sessions,
      adherence: repos.stats.domainAdherence(mountain.id),
    });
    totalAltitude = sum(series.map((day) => day.altitude));
    todayAltitude = series.find((day) => day.localDate === today)?.altitude ?? 0;
  }

  // The route always has one more step above the last finished chunk, so finishing
  // everything planned so far never looks like the summit.
  const routeChunks: RouteChunk[] = chunks.map((chunk) => ({
    campIndex: chunk.campPosition,
    done: chunk.doneAt !== null,
  }));
  if (routeChunks.every((chunk) => chunk.done)) {
    const lastCamp = Math.max(-1, ...routeChunks.map((chunk) => chunk.campIndex));
    routeChunks.push({ campIndex: lastCamp + 1, done: false });
  }

  const campIndexes = [...new Set(routeChunks.map((chunk) => chunk.campIndex))].sort(
    (a, b) => a - b,
  );
  let through = 0;
  const campMarkers: number[] = [];
  for (const campIndex of campIndexes.slice(0, -1)) {
    through += routeChunks.filter((chunk) => chunk.campIndex === campIndex).length;
    campMarkers.push(through / routeChunks.length);
  }

  return {
    mountain,
    activeSessionId: repos.sessions.getActive()?.id ?? null,
    pendingCheckinSessionId: lastSession && lastSession.checkin === null ? lastSession.id : null,
    nextChunk: repos.chunks.next(mountain.id) ?? null,
    todayAltitude,
    totalAltitude,
    totalFlowMinutes: sum(sessions.map((session) => session.flowSeconds / 60)),
    climbCount: sessions.length,
    climbedToday: sessions.some((session) => session.localDate === today),
    daysToTarget: daysBetween(today, mountain.targetDate),
    route: routePosition(routeChunks, lastSession?.localDate ?? null, today),
    campMarkers,
    stepSize: 1 / routeChunks.length,
    hasChecklist: repos.routine.list(mountain.id, 'add').length > 0,
    setupPrompt: loadSetupPrompt(
      repos,
      mountain.id,
      firstDate ? dayNumber(firstDate, today) : null,
    ),
  };
}
