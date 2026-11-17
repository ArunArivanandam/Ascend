import { screen } from 'expo-router/testing-library';

import { createTestDb } from '@/db/__tests__/testDb';
import { localTimeToInstant, REMINDER_DAYS_AHEAD } from '@/domain';
import { REMINDER_TIME_KEY } from '@/features/reminders/reminders';

import {
  createFakeNotifications,
  DAY_SECONDS,
  finishClimb,
  mockAppState,
  onboard,
  press,
  pressLabel,
  settle,
  TIME_ZONE,
  type,
} from './harness';

afterEach(() => jest.restoreAllMocks());

describe('daily reminder', () => {
  it('asks for permission, schedules one reminder a day and can be moved or turned off', async () => {
    const t = createTestDb(); // 09:30 on 17 Nov 2026
    const notifications = createFakeNotifications({ allowWhenAsked: true });
    await onboard(t, 'Finish my thesis', { notifications });
    await finishClimb(t, 10);
    await press('back-to-mountain');

    // Nothing is scheduled, and nobody is asked, until the user turns reminders on.
    expect(notifications.prompts).toBe(0);
    expect(notifications.reminders).toEqual([]);

    await press('tab-settings');
    await press('reminder-on');
    await settle();
    expect(notifications.prompts).toBe(1);
    expect(screen.getByTestId('reminder-time')).toHaveTextContent('09:00');
    expect(t.repos.settings.get(REMINDER_TIME_KEY)).toBe('09:00');

    // Already climbed today, so the first reminder is tomorrow at 09:00 local time.
    expect(notifications.reminders).toHaveLength(REMINDER_DAYS_AHEAD);
    expect(notifications.reminders[0]).toEqual({
      at: localTimeToInstant('2026-11-18', 9, 0, TIME_ZONE),
      title: 'Time to climb',
      body: 'Finish my thesis',
    });

    await pressLabel('Move reminder later by 60 minutes');
    await settle();
    expect(screen.getByTestId('reminder-time')).toHaveTextContent('10:00');
    expect(notifications.reminders[0]?.at).toBe(localTimeToInstant('2026-11-18', 10, 0, TIME_ZONE));

    await press('reminder-off');
    await settle();
    expect(notifications.reminders).toEqual([]);
    expect(t.repos.settings.get(REMINDER_TIME_KEY)).toBeNull();
    expect(screen.getByTestId('reminder-on')).toBeOnTheScreen();
  });

  it('explains what to do when the phone refuses notifications', async () => {
    const t = createTestDb();
    const notifications = createFakeNotifications({ allowWhenAsked: false });
    await onboard(t, 'Book', { notifications });
    await finishClimb(t, 10);
    await press('back-to-mountain');
    await press('tab-settings');

    await press('reminder-on');
    await settle();
    expect(screen.getByTestId('reminder-denied')).toBeOnTheScreen();
    expect(t.repos.settings.get(REMINDER_TIME_KEY)).toBeNull();
    expect(notifications.reminders).toEqual([]);
  });

  it('reminds today while there is no climb yet, names the next chunk, and re-plans on return', async () => {
    const t = createTestDb();
    const notifications = createFakeNotifications({ granted: true });
    const emitAppState = mockAppState();
    await onboard(t, 'Book', { notifications });
    await finishClimb(t, 10, { done: false });
    await press('back-to-mountain');
    await press('tab-settings');
    await press('reminder-on');
    await settle();
    await pressLabel('Move reminder later by 60 minutes'); // 10:00
    await settle();
    expect(notifications.prompts).toBe(0); // permission was already granted

    // Next morning at 09:40 the app is opened: today's 10:00 reminder is still ahead.
    t.advance(DAY_SECONDS);
    await emitAppState('active');
    await settle();
    expect(notifications.reminders).toHaveLength(REMINDER_DAYS_AHEAD + 1);
    expect(notifications.reminders[0]).toMatchObject({
      at: localTimeToInstant('2026-11-18', 10, 0, TIME_ZONE),
      body: 'Book: First climb',
    });

    // Climbing shows the ongoing notice, and finishing drops both it and today's reminder.
    await press('tab-mountain');
    await press('start-climb');
    await settle();
    expect(notifications.climbNotice).toEqual({ title: 'Climb in progress', body: 'First climb' });
    t.advance(15 * 60);
    await press('end-climb');
    await settle();
    expect(notifications.climbNotice).toBeNull();
    expect(notifications.reminders).toHaveLength(REMINDER_DAYS_AHEAD);
    expect(notifications.reminders[0]?.at).toBe(localTimeToInstant('2026-11-19', 10, 0, TIME_ZONE));
  });

  it('never shows the climb notice or loads notifications while reminders are off', async () => {
    const t = createTestDb();
    const notifications = createFakeNotifications({ granted: true });
    await onboard(t, 'Book', { notifications });
    await settle();
    expect(notifications.climbNotice).toBeNull();
    expect(notifications.reminders).toEqual([]);
  });
});

describe('mountain details', () => {
  it('renames the mountain and moves the summit date, never before today', async () => {
    const t = createTestDb();
    await onboard(t);
    await finishClimb(t, 10);
    await press('back-to-mountain');
    await press('tab-settings');

    expect(screen.getByTestId('target-date')).toHaveTextContent('17 Dec 2026'); // 1 month preset
    await pressLabel('Move summit date later by 7 days');
    expect(screen.getByTestId('target-date')).toHaveTextContent('24 Dec 2026');
    await pressLabel('Move summit date earlier by 30 days');
    await pressLabel('Move summit date earlier by 30 days');
    expect(screen.getByTestId('target-date')).toHaveTextContent('17 Nov 2026');

    await type('mountain-rename-input', 'Thesis, final version');
    await press('mountain-rename-save');
    await press('tab-mountain');
    expect(screen.getByTestId('mountain-title')).toHaveTextContent('Thesis, final version');
  });
});

describe('developer tools', () => {
  it('are hidden unless the build provides a development clock', async () => {
    const t = createTestDb();
    await onboard(t);
    await finishClimb(t, 10);
    await press('back-to-mountain');
    await press('tab-settings');
    expect(screen.queryByTestId('dev-advance-day')).toBeNull();
  });

  it('advance the app clock a day at a time and reset it', async () => {
    const t = createTestDb();
    await onboard(t, 'Book', { withDevClock: true });
    await finishClimb(t, 10);
    await press('back-to-mountain');
    await press('tab-settings');

    expect(screen.getByTestId('dev-date')).toHaveTextContent(/17 Nov 2026 \(real time\)/);
    await press('dev-advance-day');
    expect(screen.getByTestId('dev-date')).toHaveTextContent(/18 Nov 2026 \(1 d ahead\)/);

    // The whole app now lives on the next day: the Add prompt appears on home.
    await press('tab-mountain');
    expect(screen.getByTestId('setup-prompt-add')).toBeOnTheScreen();

    await press('tab-settings');
    await press('dev-reset-clock');
    expect(screen.getByTestId('dev-date')).toHaveTextContent(/17 Nov 2026 \(real time\)/);
  });
});
