import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useRepos } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

import { loadPlan, type PlanData } from './plan-data';
import { RouteEditor } from './RouteEditor';
import { RoutineList } from './RoutineList';

const SECTIONS = [
  { key: 'divide', label: 'Divide' },
  { key: 'add', label: 'Add' },
  { key: 'subtract', label: 'Subtract' },
] as const;

type Section = (typeof SECTIONS)[number]['key'];

function isSection(value: string | undefined): value is Section {
  return SECTIONS.some((section) => section.key === value);
}

/** The Plan tab: Divide (route), Add (pre-climb routine) and Subtract (distractions). */
export function PlanScreen() {
  const repos = useRepos();
  const palette = usePalette();
  // Home's setup cards open this tab with a section to show; `at` changes on every tap.
  const params = useLocalSearchParams<{ section?: string; at?: string }>();
  // undefined = not loaded yet, null = no mountain yet.
  const [data, setData] = useState<PlanData | null | undefined>(undefined);
  const [section, setSection] = useState<Section>('divide');
  const [appliedAt, setAppliedAt] = useState<string | undefined>(undefined);

  if (params.at !== appliedAt) {
    setAppliedAt(params.at);
    if (isSection(params.section)) setSection(params.section);
  }

  const reload = useCallback(() => setData(loadPlan(repos)), [repos]);
  useFocusEffect(reload);

  if (data === undefined) {
    return <View style={[styles.blank, { backgroundColor: palette.background }]} />;
  }
  if (data === null) return <Redirect href="/" />;

  return (
    <Screen>
      <Text style={[styles.title, { color: palette.text }]}>Plan</Text>

      <View
        accessibilityRole="tablist"
        style={[styles.segments, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        {SECTIONS.map((item) => {
          const selected = item.key === section;
          return (
            <Pressable
              key={item.key}
              testID={`plan-section-${item.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setSection(item.key)}
              style={[styles.segment, selected && { backgroundColor: palette.accent }]}
            >
              <Text
                style={[styles.segmentLabel, { color: selected ? palette.onAccent : palette.text }]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'divide' && <RouteEditor data={data} onChanged={reload} />}
      {section === 'add' && (
        <RoutineList
          kind="add"
          mountainId={data.mountain.id}
          items={data.addItems}
          onChanged={reload}
        />
      )}
      {section === 'subtract' && (
        <RoutineList
          kind="subtract"
          mountainId={data.mountain.id}
          items={data.subtractItems}
          onChanged={reload}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700' },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { fontSize: 15, fontWeight: '600' },
});
