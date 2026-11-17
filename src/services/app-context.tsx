import { createContext, useContext, type ReactNode } from 'react';

import type { Repositories } from '@/db/repositories';
import type { LocalDate } from '@/domain';

export interface Clock {
  /** Epoch milliseconds. */
  now: () => number;
  /** Today's date in the user's timezone. */
  today: () => LocalDate;
  /** The device's IANA timezone, e.g. "Asia/Kolkata". */
  timeZone: () => string;
}

/** Development only: shifts the app's clock so several days can be tested in minutes. */
export interface DevClock {
  offsetMs: () => number;
  setOffsetMs: (offsetMs: number) => void;
}

export interface ScheduledReminder {
  /** Epoch milliseconds on the real device clock. */
  at: number;
  title: string;
  body: string;
}

/** Local notifications. The real one wraps expo-notifications; tests use a fake. */
export interface NotificationsService {
  /** True when the app may show notifications. Never prompts. */
  hasPermission: () => Promise<boolean>;
  /** Shows the system prompt if needed. False when denied or unsupported. */
  requestPermission: () => Promise<boolean>;
  /** Replaces every scheduled climb reminder with these. */
  setReminders: (reminders: readonly ScheduledReminder[]) => Promise<void>;
  /** Shows (or updates) the ongoing "climb in progress" notification. */
  showClimbInProgress: (title: string, body: string) => Promise<void>;
  clearClimbInProgress: () => Promise<void>;
}

export interface AppServices {
  repos: Repositories;
  clock: Clock;
  notifications: NotificationsService;
  /** Present only in development builds. */
  devClock?: DevClock;
}

const AppContext = createContext<AppServices | null>(null);

/** Supplies the database, clock and notifications. Tests pass in-memory versions. */
export function AppServicesProvider(props: { value: AppServices; children: ReactNode }) {
  return <AppContext.Provider value={props.value}>{props.children}</AppContext.Provider>;
}

export function useAppServices(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('useAppServices must be used inside AppServicesProvider');
  return services;
}

export function useRepos(): Repositories {
  return useAppServices().repos;
}

export function useClock(): Clock {
  return useAppServices().clock;
}
