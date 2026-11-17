import { Platform } from 'react-native';

import type { NotificationsService, ScheduledReminder } from './app-context';

type ExpoNotifications = typeof import('expo-notifications');

const REMINDER_CHANNEL = 'climb-reminders';
const CLIMB_CHANNEL = 'climb-in-progress';
const CLIMB_NOTIFICATION_ID = 'climb-in-progress';

let loading: Promise<ExpoNotifications | null> | undefined;

/**
 * Loads expo-notifications the first time it is needed, so the app never touches
 * notifications (or asks for permission) until the user turns reminders on.
 * Resolves to null where notifications are not available, such as the web preview.
 */
function load(): Promise<ExpoNotifications | null> {
  loading ??= (async () => {
    if (Platform.OS === 'web') return null;
    try {
      const Notifications = await import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
          name: 'Climb reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
        await Notifications.setNotificationChannelAsync(CLIMB_CHANNEL, {
          name: 'Climb in progress',
          importance: Notifications.AndroidImportance.LOW,
        });
      }
      return Notifications;
    } catch (error) {
      console.warn('[notifications] unavailable', error);
      return null;
    }
  })();
  return loading;
}

/** Runs a notification call; a failure is logged and never reaches the screen. */
async function safely<T>(
  fallback: T,
  run: (notifications: ExpoNotifications) => Promise<T>,
): Promise<T> {
  const Notifications = await load();
  if (!Notifications) return fallback;
  try {
    return await run(Notifications);
  } catch (error) {
    console.warn('[notifications] call failed', error);
    return fallback;
  }
}

/** Local notifications on the device. No push server is involved. */
export const deviceNotifications: NotificationsService = {
  hasPermission: () => safely(false, async (N) => (await N.getPermissionsAsync()).granted),

  requestPermission: () =>
    safely(false, async (N) => {
      const current = await N.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      return (await N.requestPermissionsAsync()).granted;
    }),

  setReminders: (reminders: readonly ScheduledReminder[]) =>
    safely(undefined, async (N) => {
      // Reminders are the only notifications this app ever schedules ahead of time.
      await N.cancelAllScheduledNotificationsAsync();
      for (const reminder of reminders) {
        await N.scheduleNotificationAsync({
          content: { title: reminder.title, body: reminder.body },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DATE,
            date: new Date(reminder.at),
            channelId: REMINDER_CHANNEL,
          },
        });
      }
    }),

  showClimbInProgress: (title: string, body: string) =>
    safely(undefined, async (N) => {
      await N.scheduleNotificationAsync({
        identifier: CLIMB_NOTIFICATION_ID,
        content: { title, body, sticky: true, autoDismiss: false },
        trigger: Platform.OS === 'android' ? { channelId: CLIMB_CHANNEL } : null,
      });
    }),

  clearClimbInProgress: () =>
    safely(undefined, async (N) => {
      await N.dismissNotificationAsync(CLIMB_NOTIFICATION_ID);
    }),
};
