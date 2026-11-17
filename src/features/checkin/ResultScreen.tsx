import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import {
  adherenceFraction,
  adherenceMultiplier,
  depthMultiplier,
  flowMinutes,
  isRated,
  sessionAltitude,
} from '@/domain';
import { formatAltitude, formatMinutes, formatMultiplier } from '@/features/format';
import { MountainView } from '@/features/mountain/MountainView';
import { loadOverview } from '@/features/mountain/overview';
import { useClock, useRepos } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

/** The altitude-gained moment after a check-in. */
export function ResultScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repos = useRepos();
  const clock = useClock();
  const router = useRouter();
  const palette = usePalette();

  const [overview] = useState(() => loadOverview(repos, clock.today()));
  const [session] = useState(() =>
    overview
      ? repos.stats.domainSessions(overview.mountain.id).find((s) => s.id === sessionId)
      : undefined,
  );

  const [dayAdherence] = useState(() =>
    overview && session
      ? repos.stats
          .domainAdherence(overview.mountain.id)
          .filter((record) => record.localDate === session.localDate)
      : [],
  );

  if (!overview || !session) return <Redirect href="/" />;

  // A is the day's routine multiplier: neutral (1.0) until there is an Add or Subtract list.
  const adherence = adherenceFraction(dayAdherence);
  const routine = adherenceMultiplier(adherence);
  const gained = sessionAltitude(session, routine);
  const depth = depthMultiplier(session.checkin);
  const rated = isRated(session.checkin);
  const chunkDone = session.checkin?.chunkDone === true;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.success }]}>
          {chunkDone ? 'Chunk complete' : 'Climb logged'}
        </Text>
        <Text testID="altitude-gained" style={[styles.gain, { color: palette.text }]}>
          +{formatAltitude(gained)}
        </Text>
        <Text testID="altitude-breakdown" style={{ color: palette.textMuted, fontSize: 15 }}>
          {formatMinutes(flowMinutes(session))} of focus × {formatMultiplier(depth)} depth
          {adherence === null ? '' : ` × ${formatMultiplier(routine)} routine`}
          {rated ? '' : ' (check-in skipped)'}
        </Text>
      </View>

      <View style={[styles.mountainCard, { borderColor: palette.border }]}>
        <MountainView
          avatarProgress={overview.route.progress}
          campMarkers={overview.campMarkers}
          accessibilityLabel={`Your mountain. You are ${Math.round(overview.route.progress * 100)} percent of the way up.`}
        />
      </View>

      <View style={styles.stats}>
        <Text style={{ color: palette.textMuted, fontSize: 16 }}>
          Today:{' '}
          <Text style={[styles.bold, { color: palette.text }]}>
            {formatAltitude(overview.todayAltitude)}
          </Text>
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 16 }}>
          Total:{' '}
          <Text style={[styles.bold, { color: palette.text }]}>
            {formatAltitude(overview.totalAltitude)}
          </Text>
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          testID="back-to-mountain"
          label="Back to the mountain"
          onPress={() => router.dismissTo('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6, marginTop: 16 },
  kicker: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  gain: { fontSize: 56, fontWeight: '700' },
  mountainCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  bold: { fontWeight: '700' },
  footer: { flexGrow: 1, justifyContent: 'flex-end' },
});
