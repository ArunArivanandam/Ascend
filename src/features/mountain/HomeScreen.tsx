import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { SetupStep } from '@/domain';
import { formatAltitude, formatDaysToTarget, formatMinutes } from '@/features/format';
import { showClimbNotification } from '@/features/reminders/reminders';
import { dismissSetupPrompt, SETUP_COPY } from '@/features/setup/setup-prompt';
import { track } from '@/services/analytics';
import { useAppServices } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

import { MountainView } from './MountainView';
import { loadOverview, type Overview } from './overview';

/** Today view: the mountain, where the avatar is, today's altitude and the next climb. */
export function HomeScreen() {
  const services = useAppServices();
  const { repos, clock } = services;
  const router = useRouter();
  const palette = usePalette();
  // undefined = not loaded yet, null = no mountain yet.
  const [overview, setOverview] = useState<Overview | null | undefined>(undefined);
  const [nextTitle, setNextTitle] = useState('');
  // Guards against a double tap creating two chunks or two climbs.
  const starting = useRef(false);

  const reload = useCallback(() => {
    starting.current = false;
    setOverview(loadOverview(repos, clock.today()));
  }, [repos, clock]);

  useFocusEffect(reload);

  // A new day may have started while the app was in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => subscription.remove();
  }, [reload]);

  if (overview === undefined) {
    return <View style={[styles.blank, { backgroundColor: palette.background }]} />;
  }
  if (overview === null) return <Redirect href="/onboarding" />;
  if (overview.activeSessionId) return <Redirect href="/climb" />;
  if (overview.pendingCheckinSessionId) {
    return (
      <Redirect
        href={{
          pathname: '/checkin/[sessionId]',
          params: { sessionId: overview.pendingCheckinSessionId },
        }}
      />
    );
  }

  const { mountain, nextChunk, route, setupPrompt } = overview;
  const canStart = nextChunk !== null || nextTitle.trim().length > 0;

  function startClimb() {
    if (!overview || !canStart || starting.current) return;
    starting.current = true;
    const chunk = nextChunk ?? repos.chunks.add(mountain.id, nextTitle);
    setNextTitle('');
    if (overview.hasChecklist) {
      // The climb starts from the pre-climb checklist.
      router.push({ pathname: '/preclimb', params: { chunkId: chunk.id } });
      return;
    }
    repos.sessions.start({ mountainId: mountain.id, chunkId: chunk.id, localDate: clock.today() });
    track('climb_started', { first: overview.climbCount === 0 });
    void showClimbNotification(services, chunk.title);
    router.replace('/climb');
  }

  function openSetup(step: SetupStep) {
    // `at` makes every tap a new navigation, so Plan always switches to this section.
    router.navigate({ pathname: '/plan', params: { section: step, at: String(clock.now()) } });
  }

  function dismissSetup(step: SetupStep) {
    dismissSetupPrompt(repos, step);
    track('setup_prompt_dismissed', { step });
    reload();
  }

  const slidBack = route.avatarProgress < route.progress;

  return (
    <Screen>
      <View style={styles.header}>
        <Text testID="mountain-title" style={[styles.title, { color: palette.text }]}>
          {mountain.name}
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 15 }}>
          {formatDaysToTarget(overview.daysToTarget)}
        </Text>
      </View>

      <View style={[styles.mountainCard, { borderColor: palette.border }]}>
        <MountainView
          avatarProgress={route.avatarProgress}
          campMarkers={overview.campMarkers}
          accessibilityLabel={`Your mountain. You are ${Math.round(route.avatarProgress * 100)} percent of the way up.`}
        />
      </View>

      {route.missedDay && (
        <Text testID="missed-day-note" style={[styles.note, { color: palette.textMuted }]}>
          {slidBack
            ? 'Welcome back. You are resting at your last camp, and everything you climbed is still yours.'
            : 'Welcome back. Everything you climbed is still yours.'}
        </Text>
      )}

      <View style={styles.stats}>
        <Stat
          label="Today"
          value={formatAltitude(overview.todayAltitude)}
          testID="today-altitude"
        />
        <Stat
          label="Total altitude"
          value={formatAltitude(overview.totalAltitude)}
          testID="total-altitude"
        />
        <Stat label="Focus time" value={formatMinutes(overview.totalFlowMinutes)} />
      </View>

      <View
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <Text style={[styles.cardLabel, { color: palette.textMuted }]}>
          {overview.climbedToday ? 'Climb again' : 'Next climb'}
        </Text>
        {nextChunk ? (
          <Text testID="next-chunk" style={[styles.cardTitle, { color: palette.text }]}>
            {nextChunk.title}
          </Text>
        ) : (
          <TextInput
            testID="next-chunk-input"
            accessibilityLabel="What will you work on next?"
            value={nextTitle}
            onChangeText={setNextTitle}
            placeholder="What will you work on next?"
            placeholderTextColor={palette.textMuted}
            maxLength={80}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
        )}
        <Button
          testID="start-climb"
          label="Start climb"
          onPress={startClimb}
          disabled={!canStart}
        />
      </View>

      {setupPrompt && (
        <View
          testID={`setup-prompt-${setupPrompt}`}
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.accent }]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {SETUP_COPY[setupPrompt].title}
          </Text>
          <Text style={[styles.note, { color: palette.textMuted }]}>
            {SETUP_COPY[setupPrompt].body}
          </Text>
          <View style={styles.promptActions}>
            <Button
              testID="setup-prompt-dismiss"
              label="Not now"
              variant="ghost"
              onPress={() => dismissSetup(setupPrompt)}
              style={styles.flex}
            />
            <Button
              testID="setup-prompt-open"
              label={SETUP_COPY[setupPrompt].action}
              variant="secondary"
              onPress={() => openSetup(setupPrompt)}
              style={styles.promptOpen}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text testID={testID} style={[styles.statValue, { color: palette.text }]}>
        {value}
      </Text>
      <Text style={{ color: palette.textMuted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  flex: { flex: 1 },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  mountainCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  note: { fontSize: 15, lineHeight: 21 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  cardLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTitle: { fontSize: 20, fontWeight: '600' },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 17 },
  promptActions: { flexDirection: 'row', gap: 10 },
  promptOpen: { flex: 2 },
});
