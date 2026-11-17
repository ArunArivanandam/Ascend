import {
  formatReminderTime,
  localMinutesOfDay,
  localTimeToInstant,
  parseReminderTime,
  planReminders,
  type ReminderTime,
} from '@/domain';
import type { Repositories } from '@/db/repositories';
import type { AppServices } from '@/services/app-context';

/** Device setting holding the reminder time as "HH:MM". Absent means reminders are off. */
export const REMINDER_TIME_KEY = 'reminder.time';
export const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 9, minute: 0 };

export function getReminderTime(repos: Repositories): ReminderTime | null {
  return parseReminderTime(repos.settings.get(REMINDER_TIME_KEY));
}

/**
 * Re-plans the daily climb reminders: one per day at the chosen time, skipping today
 * once the user has climbed. Safe to call often (app start, app foreground, after a
 * climb, after a settings change). Does nothing while reminders are off, so the app
 * never touches notifications until the user asks for them.
 */
export async function syncReminders(services: AppServices): Promise<void> {
  const { repos, clock, notifications } = services;
  const time = getReminderTime(repos);
  if (!time) return;
  if (!(await notifications.hasPermission())) return;

  const mountain = repos.mountains.getActive();
  if (!mountain) {
    await notifications.setReminders([]);
    return;
  }

  const today = clock.today();
  const timeZone = clock.timeZone();
  const climbedToday = repos.stats
    .domainSessions(mountain.id)
    .some((session) => session.localDate === today);
  const slots = planReminders({
    today,
    minutesNow: localMinutesOfDay(clock.now(), timeZone),
    time,
    climbedToday,
  });

  const nextChunk = repos.chunks.next(mountain.id);
  const body = nextChunk ? `${mountain.name}: ${nextChunk.title}` : mountain.name;
  // The phone fires notifications on its real clock, so undo any development offset.
  const devOffsetMs = services.devClock?.offsetMs() ?? 0;

  await notifications.setReminders(
    slots.map((slot) => ({
      at: localTimeToInstant(slot.localDate, slot.hour, slot.minute, timeZone) - devOffsetMs,
      title: 'Time to climb',
      body,
    })),
  );
}

export type ReminderChange = 'on' | 'off' | 'denied';

/**
 * Turns the reminder on (asking for notification permission if needed), changes its
 * time, or turns it off with `null`. Returns 'denied' when the phone refuses permission.
 */
export async function setReminderTime(
  services: AppServices,
  time: ReminderTime | null,
): Promise<ReminderChange> {
  const { repos, notifications } = services;
  if (time === null) {
    if (getReminderTime(repos)) {
      await notifications.setReminders([]);
      await notifications.clearClimbInProgress();
    }
    repos.settings.remove(REMINDER_TIME_KEY);
    return 'off';
  }
  if (!(await notifications.requestPermission())) return 'denied';
  repos.settings.set(REMINDER_TIME_KEY, formatReminderTime(time));
  await syncReminders(services);
  return 'on';
}

/**
 * Shows the ongoing "climb in progress" notification. Only for users who turned
 * reminders on: the app never asks for notification permission just to start a climb.
 */
export async function showClimbNotification(
  services: AppServices,
  chunkTitle: string,
): Promise<void> {
  if (!getReminderTime(services.repos)) return;
  if (!(await services.notifications.hasPermission())) return;
  await services.notifications.showClimbInProgress('Climb in progress', chunkTitle);
}

export async function clearClimbNotification(services: AppServices): Promise<void> {
  if (!getReminderTime(services.repos)) return;
  await services.notifications.clearClimbInProgress();
}
