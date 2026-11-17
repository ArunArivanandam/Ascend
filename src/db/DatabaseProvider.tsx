import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppServicesProvider, type AppServices } from '@/services/app-context';
import { deviceNotifications } from '@/services/notifications';
import { usePalette } from '@/theme/colors';

import { openAppDatabase } from './client';

/** Opens the device database, applies pending migrations, then renders the app. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const [services, setServices] = useState<AppServices | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    openAppDatabase().then(
      ({ repos, clock, devClock }) => {
        if (cancelled) return;
        setServices({
          repos,
          clock,
          notifications: deviceNotifications,
          devClock: __DEV__ ? devClock : undefined,
        });
      },
      (reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>Could not open your data</Text>
        <Text style={{ color: palette.textMuted }}>{error.message}</Text>
      </View>
    );
  }
  if (!services) return <View style={[styles.center, { backgroundColor: palette.background }]} />;

  return <AppServicesProvider value={services}>{children}</AppServicesProvider>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 18, fontWeight: '600' },
});
