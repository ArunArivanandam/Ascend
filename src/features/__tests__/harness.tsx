import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import { AppTabs } from '@/components/AppTabs';
import { createTestDb } from '@/db/__tests__/testDb';
import { toLocalDate } from '@/domain';
import { CheckinScreen } from '@/features/checkin/CheckinScreen';
import { ResultScreen } from '@/features/checkin/ResultScreen';
import { ClimbScreen } from '@/features/climb/ClimbScreen';
import { PreClimbScreen } from '@/features/climb/PreClimbScreen';
import { HomeScreen } from '@/features/mountain/HomeScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { PlanScreen } from '@/features/plan/PlanScreen';
import { ReminderSync } from '@/features/reminders/ReminderSync';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import {
  AppServicesProvider,
  type AppServices,
  type NotificationsService,
  type ScheduledReminder,
} from '@/services/app-context';

export type TestDb = ReturnType<typeof createTestDb>;

/** The test clock's timezone. The test database starts at 09:30 on 17 Nov 2026 there. */
export const TIME_ZONE = 'Asia/Kolkata';
export const DAY_SECONDS = 24 * 60 * 60;

export interface FakeNotifications extends NotificationsService {
  reminders: ScheduledReminder[];
  climbNotice: { title: string; body: string } | null;
  prompts: number;
}

/** Records what the app asks of the notification system instead of touching a phone. */
export function createFakeNotifications(options: {
  granted?: boolean;
  /** What the user answers when the permission prompt appears. */
  allowWhenAsked?: boolean;
}): FakeNotifications {
  let granted = options.granted ?? false;
  const fake: FakeNotifications = {
    reminders: [],
    climbNotice: null,
    prompts: 0,
    hasPermission: async () => granted,
    requestPermission: async () => {
      if (!granted) {
        fake.prompts += 1;
        granted = options.allowWhenAsked ?? false;
      }
      return granted;
    },
    setReminders: async (reminders) => {
      fake.reminders = [...reminders];
    },
    showClimbInProgress: async (title, body) => {
      fake.climbNotice = { title, body };
    },
    clearClimbInProgress: async () => {
      fake.climbNotice = null;
    },
  };
  return fake;
}

export interface RenderOptions {
  initialUrl?: string;
  notifications?: NotificationsService;
  /** Expose the development clock tools, as a development build does. */
  withDevClock?: boolean;
}

/** Renders the real screens with the real router, on an in-memory database. */
export async function renderApp(t: TestDb, options: RenderOptions = {}) {
  const services: AppServices = {
    repos: t.repos,
    clock: {
      now: t.now,
      today: () => toLocalDate(new Date(t.now()), TIME_ZONE),
      timeZone: () => TIME_ZONE,
    },
    notifications: options.notifications ?? createFakeNotifications({}),
    devClock: options.withDevClock
      ? { offsetMs: t.offsetMs, setOffsetMs: t.setOffsetMs }
      : undefined,
  };
  function Layout() {
    return (
      <AppServicesProvider value={services}>
        <ReminderSync />
        <Stack screenOptions={{ headerShown: false }} />
      </AppServicesProvider>
    );
  }
  return renderRouter(
    {
      _layout: Layout,
      '(tabs)/_layout': AppTabs,
      '(tabs)/index': HomeScreen,
      '(tabs)/plan': PlanScreen,
      '(tabs)/settings': SettingsScreen,
      onboarding: OnboardingScreen,
      climb: ClimbScreen,
      preclimb: PreClimbScreen,
      'checkin/[sessionId]': CheckinScreen,
      'result/[sessionId]': ResultScreen,
    },
    { initialUrl: options.initialUrl ?? '/' },
  );
}

export async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Presses a control by its accessibility label, as a screen-reader user would find it. */
export async function pressLabel(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

export async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

/**
 * Lets pending promises (for example reminder scheduling) finish. The router's test
 * library runs on fake timers, so this flushes promise callbacks instead of waiting.
 */
export async function settle() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

export async function onboard(t: TestDb, name = 'Finish my thesis', options: RenderOptions = {}) {
  const app = await renderApp(t, options);
  await type('mountain-name', name);
  await press('start-first-climb');
  return app;
}

/** Ends the running climb after `minutes` and answers the check-in with one tap value. */
export async function finishClimb(
  t: TestDb,
  minutes: number,
  options: { tap?: 1 | 2 | 3 | 4 | 5; done?: boolean } = {},
) {
  const tap = options.tap ?? 3;
  t.advance(minutes * 60);
  await press('end-climb');
  await press(`focus-${tap}`);
  await press(`challengeSkill-${tap}`);
  await press(`timePassing-${tap}`);
  await press(options.done === false ? 'chunk-not-done' : 'chunk-done');
}

/** Moves to the next day and refreshes the home screen, as reopening the app would. */
export async function nextDay(t: TestDb) {
  t.advance(DAY_SECONDS);
  await press('tab-plan');
  await press('tab-mountain');
}

/**
 * Captures the app-state listeners so a test can pretend the app went to the
 * background or came back. Call the returned function with the new state.
 */
export function mockAppState() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    const handler = listener as (state: AppStateStatus) => void;
    listeners.add(handler);
    return { remove: () => listeners.delete(handler) } as ReturnType<
      typeof AppState.addEventListener
    >;
  });
  return async (state: AppStateStatus) => {
    await act(async () => {
      for (const listener of [...listeners]) listener(state);
    });
  };
}
