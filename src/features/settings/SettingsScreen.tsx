import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { InlineTextForm } from '@/components/InlineTextForm';
import { Screen } from '@/components/Screen';
import type { MountainRow } from '@/db/schema';
import {
  addDays,
  daysBetween,
  formatReminderTime,
  shiftReminderTime,
  type LocalDate,
  type ReminderTime,
} from '@/domain';
import { formatDaysToTarget, formatLongDate } from '@/features/format';
import {
  DEFAULT_REMINDER_TIME,
  getReminderTime,
  setReminderTime,
  syncReminders,
} from '@/features/reminders/reminders';
import { track } from '@/services/analytics';
import { useAppServices, type AppServices } from '@/services/app-context';
import { DEV_CLOCK_OFFSET_KEY } from '@/services/clock';
import { usePalette } from '@/theme/colors';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_STEPS = [-30, -7, -1, 1, 7, 30] as const;
const TIME_STEPS = [
  { label: '−1 h', minutes: -60 },
  { label: '−15 min', minutes: -15 },
  { label: '+15 min', minutes: 15 },
  { label: '+1 h', minutes: 60 },
] as const;

interface SettingsData {
  mountain: MountainRow;
  today: LocalDate;
  reminder: ReminderTime | null;
  devOffsetDays: number | null;
}

function loadSettings({ repos, clock, devClock }: AppServices): SettingsData | null {
  const mountain = repos.mountains.getActive();
  if (!mountain) return null;
  return {
    mountain,
    today: clock.today(),
    reminder: getReminderTime(repos),
    devOffsetDays: devClock ? Math.round(devClock.offsetMs() / DAY_MS) : null,
  };
}

/** Settings tab: mountain name and summit date, the daily reminder, and developer tools. */
export function SettingsScreen() {
  const services = useAppServices();
  const { repos, devClock } = services;
  const palette = usePalette();
  // undefined = not loaded yet, null = no mountain yet.
  const [data, setData] = useState<SettingsData | null | undefined>(undefined);
  const [reminderDenied, setReminderDenied] = useState(false);

  const reload = useCallback(() => setData(loadSettings(services)), [services]);
  useFocusEffect(reload);

  if (data === undefined) {
    return <View style={[styles.blank, { backgroundColor: palette.background }]} />;
  }
  if (data === null) return <Redirect href="/" />;

  const { mountain, today, reminder } = data;

  function moveTargetDate(days: number) {
    // The summit date can be today at the earliest.
    const moved = addDays(mountain.targetDate, days);
    repos.mountains.update(mountain.id, {
      targetDate: daysBetween(today, moved) < 0 ? today : moved,
    });
    reload();
  }

  async function changeReminder(time: ReminderTime | null) {
    const result = await setReminderTime(services, time);
    setReminderDenied(result === 'denied');
    if (result === 'on' && !reminder) track('reminder_enabled', {});
    if (result === 'off') track('reminder_disabled', {});
    reload();
  }

  function setDevOffsetDays(days: number) {
    if (!devClock) return;
    devClock.setOffsetMs(days * DAY_MS);
    repos.settings.set(DEV_CLOCK_OFFSET_KEY, String(days * DAY_MS));
    void syncReminders(services);
    reload();
  }

  return (
    <Screen>
      <Text style={[styles.title, { color: palette.text }]}>Settings</Text>

      <Card title="Your mountain">
        <InlineTextForm
          key={mountain.name}
          testID="mountain-rename"
          initialValue={mountain.name}
          placeholder="Mountain name"
          saveLabel="Save name"
          maxLength={60}
          onSave={(name) => {
            repos.mountains.update(mountain.id, { name });
            reload();
          }}
        />
        <View style={styles.block}>
          <Text style={[styles.label, { color: palette.textMuted }]}>Summit date</Text>
          <Text testID="target-date" style={[styles.value, { color: palette.text }]}>
            {formatLongDate(mountain.targetDate)}
          </Text>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>
            {formatDaysToTarget(daysBetween(today, mountain.targetDate))}
          </Text>
          <View style={styles.steps}>
            {DATE_STEPS.map((days) => (
              <Step
                key={days}
                label={`${days > 0 ? '+' : '−'}${Math.abs(days)} d`}
                accessibilityLabel={`Move summit date ${days > 0 ? 'later' : 'earlier'} by ${Math.abs(days)} days`}
                onPress={() => moveTargetDate(days)}
              />
            ))}
          </View>
        </View>
      </Card>

      <Card title="Daily reminder">
        {reminder ? (
          <>
            <Text testID="reminder-time" style={[styles.value, { color: palette.text }]}>
              {formatReminderTime(reminder)}
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 20 }}>
              One reminder a day at this time, skipped on days you have already climbed.
            </Text>
            <View style={styles.steps}>
              {TIME_STEPS.map((step) => (
                <Step
                  key={step.minutes}
                  label={step.label}
                  accessibilityLabel={`Move reminder ${step.minutes > 0 ? 'later' : 'earlier'} by ${Math.abs(step.minutes)} minutes`}
                  onPress={() => changeReminder(shiftReminderTime(reminder, step.minutes))}
                />
              ))}
            </View>
            <Button
              testID="reminder-off"
              label="Turn off reminder"
              variant="ghost"
              onPress={() => changeReminder(null)}
            />
          </>
        ) : (
          <>
            <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 20 }}>
              Get one nudge a day to climb, at a time you choose.
            </Text>
            <Button
              testID="reminder-on"
              label="Turn on a daily reminder"
              variant="secondary"
              onPress={() => changeReminder(DEFAULT_REMINDER_TIME)}
            />
          </>
        )}
        {reminderDenied && (
          <Text testID="reminder-denied" style={{ color: palette.danger, fontSize: 14 }}>
            Notifications are turned off for this app. Allow them in your phone settings, then try
            again.
          </Text>
        )}
      </Card>

      {data.devOffsetDays !== null && (
        <Card title="Developer tools">
          <Text testID="dev-date" style={{ color: palette.textMuted, fontSize: 14 }}>
            The app thinks today is {formatLongDate(today)}
            {data.devOffsetDays === 0 ? ' (real time).' : ` (${data.devOffsetDays} d ahead).`}
          </Text>
          <Button
            testID="dev-advance-day"
            label="Advance one day"
            variant="secondary"
            onPress={() => setDevOffsetDays((data.devOffsetDays ?? 0) + 1)}
          />
          <Button
            testID="dev-reset-clock"
            label="Back to real time"
            variant="ghost"
            onPress={() => setDevOffsetDays(0)}
          />
        </Card>
      )}
    </Screen>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Step(props: { label: string; accessibilityLabel: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={[styles.step, { borderColor: palette.border }]}
    >
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  block: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 24, fontWeight: '700' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  step: {
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
