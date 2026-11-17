import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TIME_TO_FLOW_OPTIONS_MIN, type DepthTap } from '@/domain';
import { formatMinutes } from '@/features/format';
import { track } from '@/services/analytics';
import { useRepos } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

const TAPS: readonly DepthTap[] = [1, 2, 3, 4, 5];

const QUESTIONS = [
  { key: 'focus', title: 'How focused were you?', low: 'Scattered', high: 'Locked in' },
  {
    key: 'challengeSkill',
    title: 'Did the challenge match your skill?',
    low: 'Poor match',
    high: 'Perfect match',
  },
  { key: 'timePassing', title: 'How did time pass?', low: 'It dragged', high: 'It flew' },
] as const;

type DepthKey = (typeof QUESTIONS)[number]['key'];

/**
 * Summit check-in: three depth taps, one time-to-flow tap, then "done" or "not done"
 * (which also saves). Skippable. Target: under 10 seconds.
 *
 * If the user has a Subtract list, it appears as chips that need a tap only for the
 * items that got through, so a clean climb costs no extra taps.
 */
export function CheckinScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repos = useRepos();
  const router = useRouter();
  const palette = usePalette();

  const [session] = useState(() => repos.sessions.get(sessionId));
  const [chunk] = useState(() => (session ? repos.chunks.get(session.chunkId) : undefined));
  const [subtractItems] = useState(() =>
    session ? repos.routine.list(session.mountainId, 'subtract') : [],
  );
  const [depth, setDepth] = useState<Partial<Record<DepthKey, DepthTap>>>({});
  const [timeToFlow, setTimeToFlow] = useState<number | null>(null);
  const [slipped, setSlipped] = useState<readonly string[]>([]);

  if (!session || session.endedAt === null) return <Redirect href="/" />;

  const { focus, challengeSkill, timePassing } = depth;
  const complete = focus !== undefined && challengeSkill !== undefined && timePassing !== undefined;

  function goToResult() {
    router.replace({ pathname: '/result/[sessionId]', params: { sessionId } });
  }

  function save(chunkDone: boolean) {
    if (focus === undefined || challengeSkill === undefined || timePassing === undefined) return;
    repos.checkins.save(sessionId, {
      focus,
      challengeSkill,
      timePassing,
      timeToFlowMin: timeToFlow,
      chunkDone,
      slippedSubtractItemIds: slipped,
    });
    track('checkin_completed', { chunkDone, timeToFlowMin: timeToFlow, slips: slipped.length });
    goToResult();
  }

  function skip() {
    repos.checkins.skip(sessionId);
    track('checkin_skipped', {});
    goToResult();
  }

  function toggleSlip(itemId: string) {
    setSlipped((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Summit check-in</Text>
        <Text style={{ color: palette.textMuted, fontSize: 15 }}>
          {formatMinutes((session.flowSeconds ?? 0) / 60)} of focus. Four quick taps.
        </Text>
      </View>

      {QUESTIONS.map((question) => (
        <View key={question.key} style={styles.question}>
          <Text style={[styles.questionTitle, { color: palette.text }]}>{question.title}</Text>
          <View style={styles.row} accessibilityRole="radiogroup">
            {TAPS.map((tap) => (
              <Choice
                key={tap}
                testID={`${question.key}-${tap}`}
                label={String(tap)}
                accessibilityLabel={`${question.title} ${tap} of 5`}
                selected={depth[question.key] === tap}
                onPress={() => setDepth((current) => ({ ...current, [question.key]: tap }))}
              />
            ))}
          </View>
          <View style={styles.scale}>
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>{question.low}</Text>
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>{question.high}</Text>
          </View>
        </View>
      ))}

      <View style={styles.question}>
        <Text style={[styles.questionTitle, { color: palette.text }]}>
          Minutes until you felt in the zone
        </Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {TIME_TO_FLOW_OPTIONS_MIN.map((minutes, index) => {
            const last = index === TIME_TO_FLOW_OPTIONS_MIN.length - 1;
            return (
              <Choice
                key={minutes}
                testID={`ttf-${minutes}`}
                label={last ? `${minutes}+` : String(minutes)}
                accessibilityLabel={`${minutes}${last ? ' or more' : ''} minutes`}
                selected={timeToFlow === minutes}
                onPress={() => setTimeToFlow(minutes)}
              />
            );
          })}
        </View>
      </View>

      {subtractItems.length > 0 && (
        <View style={styles.question}>
          <Text style={[styles.questionTitle, { color: palette.text }]}>
            Did any of these pull you away?
          </Text>
          <View style={styles.chips}>
            {subtractItems.map((item) => {
              const selected = slipped.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${item.label} pulled me away`}
                  onPress={() => toggleSlip(item.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? palette.danger : palette.surface,
                      borderColor: selected ? palette.danger : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={{ color: selected ? palette.onAccent : palette.text, fontWeight: '600' }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>
            Tap any that did. Leave the rest untouched.
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={[styles.questionTitle, { color: palette.text }]}>
          Did you finish “{chunk?.title ?? 'this chunk'}”?
        </Text>
        <View style={styles.row}>
          <Button
            testID="chunk-not-done"
            label="Not yet"
            variant="secondary"
            disabled={!complete}
            onPress={() => save(false)}
            style={styles.flex}
          />
          <Button
            testID="chunk-done"
            label="Done"
            disabled={!complete}
            onPress={() => save(true)}
            style={styles.flex}
          />
        </View>
        <Button testID="skip-checkin" label="Skip check-in" variant="ghost" onPress={skip} />
      </View>
    </Screen>
  );
}

function Choice(props: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="radio"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[
        styles.choice,
        {
          backgroundColor: props.selected ? palette.accent : palette.surface,
          borderColor: props.selected ? palette.accent : palette.border,
        },
      ]}
    >
      <Text
        style={[styles.choiceLabel, { color: props.selected ? palette.onAccent : palette.text }]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  question: { gap: 8 },
  questionTitle: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  choice: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLabel: { fontSize: 17, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', gap: 10 },
});
