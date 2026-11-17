import type { Repositories } from '@/db/repositories';
import type { CampRow, ChunkRow, MountainRow, RoutineItemRow } from '@/db/schema';
import { estimateAccuracy } from '@/domain';
import { formatMinutes } from '@/features/format';

export interface PlanChunk extends ChunkRow {
  /** Focus time spent on this chunk so far. */
  focusSeconds: number;
}

export interface PlanCamp extends CampRow {
  chunks: PlanChunk[];
}

export interface PlanData {
  mountain: MountainRow;
  camps: PlanCamp[];
  addItems: RoutineItemRow[];
  subtractItems: RoutineItemRow[];
}

/** Everything the Plan tab shows, or null when there is no mountain yet. */
export function loadPlan(repos: Repositories): PlanData | null {
  const mountain = repos.mountains.getActive();
  if (!mountain) return null;
  const focus = repos.stats.focusSecondsByChunk(mountain.id);
  const chunks = repos.chunks.list(mountain.id);
  return {
    mountain,
    camps: repos.camps.list(mountain.id).map((camp) => ({
      ...camp,
      chunks: chunks
        .filter((chunk) => chunk.campId === camp.id)
        .map((chunk) => ({ ...chunk, focusSeconds: focus.get(chunk.id) ?? 0 })),
    })),
    addItems: repos.routine.list(mountain.id, 'add'),
    subtractItems: repos.routine.list(mountain.id, 'subtract'),
  };
}

/** One line under a chunk title: its estimate and how long it has taken. */
export function describeChunk(chunk: PlanChunk): string {
  const spent = chunk.focusSeconds > 0 ? formatMinutes(chunk.focusSeconds / 60) : null;
  if (chunk.doneAt !== null) {
    const accuracy = estimateAccuracy(chunk.estimateMin, chunk.focusSeconds);
    if (accuracy) {
      return `Planned ${formatMinutes(accuracy.estimateMin)} · took ${formatMinutes(accuracy.actualMin)}`;
    }
    return spent ? `Took ${spent}` : 'Done';
  }
  const planned = chunk.estimateMin ? `${formatMinutes(chunk.estimateMin)} planned` : 'No estimate';
  return spent ? `${planned} · ${spent} so far` : planned;
}
