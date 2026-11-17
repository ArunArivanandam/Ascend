import { toLocalDate } from '@/domain';

import type { Clock, DevClock } from './app-context';

/** Device setting that keeps the development clock offset across reloads. */
export const DEV_CLOCK_OFFSET_KEY = 'dev.clockOffsetMs';

/**
 * The device clock. `devClock` can shift it forward (development only) so that the
 * day-by-day setup prompts and missed-day behaviour can be tested without waiting.
 * Everything in the app, including the database, must read time through this clock.
 */
export function createDeviceClock(): { clock: Clock; devClock: DevClock } {
  let offsetMs = 0;
  const now = () => Date.now() + offsetMs;
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    clock: { now, timeZone, today: () => toLocalDate(new Date(now()), timeZone()) },
    devClock: {
      offsetMs: () => offsetMs,
      setOffsetMs: (next) => {
        offsetMs = next;
      },
    },
  };
}
