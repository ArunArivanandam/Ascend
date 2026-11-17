import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { ReminderSync } from '@/features/reminders/ReminderSync';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DatabaseProvider>
        <ReminderSync />
        <Stack screenOptions={{ headerShown: false }} />
      </DatabaseProvider>
    </ThemeProvider>
  );
}
