import { DIVIDED_MIN_PLANNED_CHUNKS, SETUP_PROMPT_DAY } from './constants';

/** The three setup steps that are introduced after day 0, in this order. */
export type SetupStep = 'add' | 'subtract' | 'divide';

export const SETUP_STEPS: readonly SetupStep[] = ['add', 'subtract', 'divide'];

export interface SetupState {
  /** 1-based day number; day 1 is the first climb. Null before the first climb. */
  dayNumber: number | null;
  /** The step is already set up (for example the Add list has items). */
  done: Readonly<Record<SetupStep, boolean>>;
  /** The user said "not now" to this step's prompt. */
  dismissed: Readonly<Record<SetupStep, boolean>>;
}

/**
 * The one setup prompt to show today, or null. Steps unlock one per day after the
 * first climb (Add, then Subtract, then Divide) so setup never blocks climbing. A
 * step that is done or dismissed is skipped; every step stays available in the Plan tab.
 */
export function nextSetupPrompt(state: SetupState): SetupStep | null {
  const { dayNumber } = state;
  if (dayNumber === null) return null;
  for (const step of SETUP_STEPS) {
    if (dayNumber < SETUP_PROMPT_DAY[step]) return null;
    if (!state.done[step] && !state.dismissed[step]) return step;
  }
  return null;
}

/** True once the user has planned ahead: several chunks waiting, or more than one camp. */
export function isRouteDivided(route: { undoneChunks: number; camps: number }): boolean {
  return route.undoneChunks >= DIVIDED_MIN_PLANNED_CHUNKS || route.camps >= 2;
}
