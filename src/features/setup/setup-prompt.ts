import type { Repositories } from '@/db/repositories';
import { isRouteDivided, nextSetupPrompt, type SetupStep } from '@/domain';

const dismissedKey = (step: SetupStep) => `setup.${step}.dismissed`;

/** The user said "not now" to a setup prompt. The step stays available in the Plan tab. */
export function dismissSetupPrompt(repos: Repositories, step: SetupStep) {
  repos.settings.set(dismissedKey(step), '1');
}

/**
 * Which setup card (Add, Subtract or Divide) to show on the home screen today, if any.
 * `dayNumber` is 1 on the day of the first climb and null before it.
 */
export function loadSetupPrompt(
  repos: Repositories,
  mountainId: string,
  dayNumber: number | null,
): SetupStep | null {
  const chunks = repos.chunks.list(mountainId);
  const dismissed = (step: SetupStep) => repos.settings.get(dismissedKey(step)) !== null;
  return nextSetupPrompt({
    dayNumber,
    done: {
      add: repos.routine.list(mountainId, 'add').length > 0,
      subtract: repos.routine.list(mountainId, 'subtract').length > 0,
      divide: isRouteDivided({
        undoneChunks: chunks.filter((chunk) => chunk.doneAt === null).length,
        camps: repos.camps.list(mountainId).length,
      }),
    },
    dismissed: {
      add: dismissed('add'),
      subtract: dismissed('subtract'),
      divide: dismissed('divide'),
    },
  });
}

export const SETUP_COPY: Record<SetupStep, { title: string; body: string; action: string }> = {
  add: {
    title: 'Add: what helps you get into flow?',
    body: 'A short walk, a glass of water, a clear desk. List them once and tick them off before each climb.',
    action: 'Set up my routine',
  },
  subtract: {
    title: 'Subtract: what breaks your flow?',
    body: 'Social apps, notifications, certain sites. List them, and after each climb you can note any that got through.',
    action: 'List my distractions',
  },
  divide: {
    title: 'Divide: split your mountain into chunks',
    body: 'Plan the next few steps with a time estimate for each, and group them into camps.',
    action: 'Plan my route',
  },
};
