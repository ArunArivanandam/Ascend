import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppServices } from '@/services/app-context';

import { syncReminders } from './reminders';

/** Keeps the climb reminders up to date: on launch and whenever the app comes forward. */
export function ReminderSync() {
  const services = useAppServices();

  useEffect(() => {
    void syncReminders(services);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders(services);
    });
    return () => subscription.remove();
  }, [services]);

  return null;
}
