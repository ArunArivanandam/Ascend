import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import {
  flowSecondsAt,
  formatClock,
  isPaused,
  isTooShort,
  MAX_SESSION_SECONDS,
  MIN_SESSION_SECONDS,
} from '@/domain';
import { MountainView } from '@/features/mountain/MountainView';
import { loadOverview } from '@/features/mountain/overview';
import { clearClimbNotification, syncReminders } from '@/features/reminders/reminders';
import { track } from '@/services/analytics';
import { useAppServices } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

/** Display only: how long the avatar takes to cross one chunk when it has no estimate. */
const DEFAULT_CHUNK_PACE_MIN = 25;

/**
 * The climb timer. Elapsed time is always computed from timestamps stored in the
 * database, so it stays correct if the app is backgrounded or killed mid-climb.
 */
export function ClimbScreen() {
  const services = useAppServices();
  const { repos, clock } = services;
  const router = useRouter();
  const palette = usePalette();

  const [active] = useState(() => repos.sessions.getActive() ?? null);
  const [timer, setTimer] = useState(() => {
    if (!active) return null;
    // If the app was killed while in the background, its exit is still open: close it.
    repos.sessions.markReturn(active.id);
    return repos.sessions.timer(active.id);
  });
  const [now, setNow] = useState(() => clock.now());
  const [chunk] = useState(() => (active ? repos.chunks.get(active.chunkId) : undefined));
  const [overview] = useState(() => loadOverview(repos, clock.today()));
  // Discarding a real climb takes two taps.
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const sessionId = active?.id;

  // Re-render once a second. This only refreshes the display; it never counts time.
  useEffect(() => {
    const interval = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(interval);
  }, [clock]);

  // Log app exits (interruptions) and refresh the clock on return.
  useEffect(() => {
    if (!sessionId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') repos.sessions.markExit(sessionId);
      if (state === 'active') repos.sessions.markReturn(sessionId);
      setTimer(repos.sessions.timer(sessionId));
      setNow(clock.now());
    });
    return () => subscription.remove();
  }, [repos, clock, sessionId]);

  if (!active || !timer) return <Redirect href="/" />;

  const elapsed = flowSecondsAt(timer, now);
  const paused = isPaused(timer);
  const tooShort = isTooShort(elapsed);
  const atCap = elapsed >= MAX_SESSION_SECONDS;

  function togglePause() {
    if (!active) return;
    if (paused) repos.sessions.resume(active.id);
    else repos.sessions.pause(active.id);
    setTimer(repos.sessions.timer(active.id));
    setNow(clock.now());
  }

  function leaveDiscarded() {
    track('climb_discarded', {});
    void clearClimbNotification(services);
    // Back to the mountain, whether or not the tabs are still underneath this screen.
    router.dismissTo('/');
  }

  function endClimb() {
    if (!active) return;
    const result = repos.sessions.end(active.id);
    if (result.discarded) {
      leaveDiscarded();
      return;
    }
    track('climb_completed', {
      flowSeconds: result.session.flowSeconds ?? 0,
      pauses: result.session.pauseCount,
      exits: result.session.exitCount,
    });
    void clearClimbNotification(services);
    // Today's reminder is no longer needed.
    void syncReminders(services);
    router.replace({ pathname: '/checkin/[sessionId]', params: { sessionId: active.id } });
  }

  function discardClimb() {
    if (!active) return;
    if (!confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    repos.sessions.discard(active.id);
    leaveDiscarded();
  }

  // The avatar climbs one chunk's worth of route as the session runs.
  const paceSeconds = (chunk?.estimateMin ?? DEFAULT_CHUNK_PACE_MIN) * 60;
  const base = overview?.route.progress ?? 0;
  const step = overview?.stepSize ?? 0;
  const avatarProgress = base + step * Math.min(1, elapsed / paceSeconds);

  let hint = 'Put your phone down. The timer keeps running while the screen is off.';
  if (tooShort) hint = `Climbs under ${MIN_SESSION_SECONDS / 60} minute are not saved.`;
  if (atCap) {
    hint = `A climb stops counting after ${MAX_SESSION_SECONDS / 3600} hours. If you forgot the timer, discard this climb.`;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.status, { color: paused ? palette.textMuted : palette.success }]}>
          {paused ? 'Paused' : 'Climbing'}
        </Text>
        <Text testID="climb-chunk" style={[styles.chunk, { color: palette.text }]}>
          {chunk?.title ?? 'Climb'}
        </Text>
      </View>

      <View style={[styles.mountainCard, { borderColor: palette.border }]}>
        <MountainView avatarProgress={avatarProgress} campMarkers={overview?.campMarkers} />
      </View>

      <Text
        testID="climb-clock"
        accessibilityLabel={`Focus time ${formatClock(elapsed)}`}
        style={[styles.clock, { color: palette.text }]}
      >
        {formatClock(elapsed)}
      </Text>

      <Text testID="climb-hint" style={[styles.hint, { color: palette.textMuted }]}>
        {hint}
      </Text>

      <View style={styles.footer}>
        <Button
          testID="pause-resume"
          label={paused ? 'Resume' : 'Pause'}
          variant="secondary"
          onPress={togglePause}
        />
        <Button
          testID="end-climb"
          label={tooShort ? 'Discard climb' : 'End climb'}
          variant={tooShort ? 'ghost' : 'primary'}
          onPress={endClimb}
        />
        {!tooShort && (
          <Button
            testID="discard-climb"
            label={confirmingDiscard ? 'Tap again to discard this climb' : 'Discard climb'}
            variant={confirmingDiscard ? 'danger' : 'ghost'}
            onPress={discardClimb}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, alignItems: 'center', marginTop: 8 },
  status: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  chunk: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  mountainCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  clock: { fontSize: 64, fontWeight: '200', textAlign: 'center', fontVariant: ['tabular-nums'] },
  hint: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', gap: 12 },
});
