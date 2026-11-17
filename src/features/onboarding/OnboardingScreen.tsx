import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { addDays } from '@/domain';
import { track } from '@/services/analytics';
import { useClock, useRepos } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

const TARGETS = [
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
] as const;

/**
 * Day-0 setup: name the mountain, pick a rough summit date, start climbing.
 * No account, no paywall, nothing else (AGENTS.md scope guardrails).
 */
export function OnboardingScreen() {
  const repos = useRepos();
  const clock = useClock();
  const router = useRouter();
  const palette = usePalette();
  const [name, setName] = useState('');
  const [targetDays, setTargetDays] = useState<number>(30);
  const [hasMountain] = useState(() => repos.mountains.getActive() !== undefined);
  const starting = useRef(false);

  if (hasMountain) return <Redirect href="/" />;

  const canStart = name.trim().length > 0;

  function start() {
    // The ref guards against a double tap creating two mountains.
    if (!canStart || starting.current) return;
    starting.current = true;
    const today = clock.today();
    const { mountain, chunk } = repos.mountains.create({
      name,
      targetDate: addDays(today, targetDays),
    });
    track('onboarding_completed', { targetDays });
    repos.sessions.start({ mountainId: mountain.id, chunkId: chunk.id, localDate: today });
    track('climb_started', { first: true });
    router.replace('/climb');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>What is your mountain?</Text>
        <Text style={[styles.body, { color: palette.textMuted }]}>
          Name the one big task you want to finish. You will climb it a little every day.
        </Text>
      </View>

      <TextInput
        testID="mountain-name"
        accessibilityLabel="Mountain name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Finish my thesis"
        placeholderTextColor={palette.textMuted}
        autoFocus
        maxLength={60}
        returnKeyType="done"
        style={[
          styles.input,
          { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      />

      <View style={styles.section}>
        <Text style={[styles.label, { color: palette.text }]}>
          When do you want to reach the top?
        </Text>
        <View style={styles.chips}>
          {TARGETS.map((target) => {
            const selected = target.days === targetDays;
            return (
              <Pressable
                key={target.days}
                testID={`target-${target.days}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setTargetDays(target.days)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? palette.accent : palette.surface,
                    borderColor: selected ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text
                  style={{ color: selected ? palette.onAccent : palette.text, fontWeight: '600' }}
                >
                  {target.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: palette.textMuted }]}>
          A rough guess is fine. You can change it later.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          testID="start-first-climb"
          label="Start my first climb"
          onPress={start}
          disabled={!canStart}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginTop: 24 },
  title: { fontSize: 30, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23 },
  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, minHeight: 54, fontSize: 18 },
  section: { gap: 10 },
  label: { fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  hint: { fontSize: 14 },
  footer: { flexGrow: 1, justifyContent: 'flex-end' },
});
