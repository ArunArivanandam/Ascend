import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InlineTextForm } from '@/components/InlineTextForm';
import type { RoutineItemRow } from '@/db/schema';
import type { RoutineKind } from '@/domain';
import { useRepos } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

const COPY: Record<RoutineKind, { intro: string; placeholder: string; suggestions: string[] }> = {
  add: {
    intro:
      'What helps you get into flow? These become your pre-climb checklist, ticked off before each climb.',
    placeholder: 'Add something that helps',
    suggestions: ['Short walk', 'Glass of water', 'Clear my desk'],
  },
  subtract: {
    intro:
      'What breaks your flow? After each climb you can note any of these that pulled you away.',
    placeholder: 'Add something to avoid',
    suggestions: ['Social apps', 'Notifications', 'News sites'],
  },
};

interface Props {
  kind: RoutineKind;
  mountainId: string;
  items: readonly RoutineItemRow[];
  onChanged: () => void;
}

/** An editable Add or Subtract list. */
export function RoutineList({ kind, mountainId, items, onChanged }: Props) {
  const repos = useRepos();
  const palette = usePalette();
  const [editingId, setEditingId] = useState<string | null>(null);
  const copy = COPY[kind];
  const existing = new Set(items.map((item) => item.label.toLowerCase()));
  const suggestions = copy.suggestions.filter((label) => !existing.has(label.toLowerCase()));

  function add(label: string) {
    repos.routine.add(mountainId, kind, label);
    onChanged();
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.intro, { color: palette.textMuted }]}>{copy.intro}</Text>

      {items.map((item) =>
        editingId === item.id ? (
          <InlineTextForm
            key={item.id}
            testID={`${kind}-edit`}
            initialValue={item.label}
            placeholder={copy.placeholder}
            saveLabel="Save"
            onCancel={() => setEditingId(null)}
            onSave={(label) => {
              repos.routine.rename(item.id, label);
              setEditingId(null);
              onChanged();
            }}
          />
        ) : (
          <View
            key={item.id}
            style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Text style={[styles.label, { color: palette.text }]}>{item.label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rename ${item.label}`}
              onPress={() => setEditingId(item.id)}
              style={styles.rowButton}
            >
              <Text style={{ color: palette.accent, fontWeight: '600' }}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.label}`}
              onPress={() => {
                repos.routine.archive(item.id);
                onChanged();
              }}
              style={styles.rowButton}
            >
              <Text style={{ color: palette.danger, fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </View>
        ),
      )}

      <InlineTextForm
        testID={`${kind}-new`}
        placeholder={copy.placeholder}
        saveLabel="Add"
        clearOnSave
        onSave={add}
      />

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>Ideas:</Text>
          {suggestions.map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Add ${label}`}
              onPress={() => add(label)}
              style={[styles.chip, { borderColor: palette.border }]}
            >
              <Text style={{ color: palette.text }}>+ {label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  intro: { fontSize: 15, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  label: { flex: 1, fontSize: 16 },
  rowButton: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
});
