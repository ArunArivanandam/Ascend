import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { showClimbNotification } from '@/features/reminders/reminders';
import { track } from '@/services/analytics';
import { useAppServices } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

/**
 * The pre-climb checklist: the user's Add items, ticked off before the timer starts.
 * What is ticked here becomes the day's Add adherence. Starting with items unticked
 * is allowed; they simply count as not done.
 */
export function PreClimbScreen() {
  const { chunkId } = useLocalSearchParams<{ chunkId: string }>();
  const services = useAppServices();
  const { repos, clock } = services;
  const router = useRouter();
  const palette = usePalette();

  const [chunk] = useState(() => repos.chunks.get(chunkId));
  const [items] = useState(() => (chunk ? repos.routine.list(chunk.mountainId, 'add') : []));
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const starting = useRef(false);

  if (!chunk || chunk.deletedAt !== null) return <Redirect href="/" />;

  function toggle(itemId: string) {
    setTicked((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  function start() {
    if (!chunk || starting.current) return;
    starting.current = true;
    repos.sessions.start({
      mountainId: chunk.mountainId,
      chunkId: chunk.id,
      localDate: clock.today(),
      tickedAddItemIds: ticked,
    });
    track('climb_started', { first: false, checklistTicked: ticked.length });
    void showClimbNotification(services, chunk.title);
    router.replace('/climb');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.textMuted }]}>Before you climb</Text>
        <Text testID="preclimb-chunk" style={[styles.title, { color: palette.text }]}>
          {chunk.title}
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 15 }}>
          Tick what you have done. These are the things that help you get into flow.
        </Text>
      </View>

      <View style={styles.list}>
        {items.map((item) => {
          const checked = ticked.includes(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item.label}
              onPress={() => toggle(item.id)}
              style={[
                styles.row,
                {
                  backgroundColor: palette.surface,
                  borderColor: checked ? palette.success : palette.border,
                },
              ]}
            >
              <View
                style={[
                  styles.box,
                  {
                    borderColor: checked ? palette.success : palette.border,
                    backgroundColor: checked ? palette.success : 'transparent',
                  },
                ]}
              >
                {checked && <Text style={[styles.tick, { color: palette.onAccent }]}>✓</Text>}
              </View>
              <Text style={[styles.rowLabel, { color: palette.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button testID="preclimb-start" label="Start climb" onPress={start} />
        <Button
          testID="preclimb-back"
          label="Back"
          variant="ghost"
          onPress={() => router.dismissTo('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginTop: 8 },
  kicker: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700' },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderRadius: 14,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 16, fontWeight: '700' },
  rowLabel: { fontSize: 17, flexShrink: 1 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', gap: 8 },
});
