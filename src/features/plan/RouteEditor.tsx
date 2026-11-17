import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { InlineTextForm } from '@/components/InlineTextForm';
import { formatMinutes } from '@/features/format';
import { useRepos } from '@/services/app-context';
import { usePalette } from '@/theme/colors';

import { describeChunk, type PlanChunk, type PlanData } from './plan-data';

/** Time estimates offered for a chunk, in minutes. A choice list for the form, not a scoring number. */
const ESTIMATE_OPTIONS_MIN = [15, 25, 45, 60, 90, 120] as const;

type Editing =
  | null
  | { kind: 'chunk'; id: string }
  | { kind: 'new-chunk'; campId: string }
  | { kind: 'camp'; id: string }
  | { kind: 'new-camp' };

interface Props {
  data: PlanData;
  onChanged: () => void;
}

/** Divide: the route as camps and chunks, with estimates, reordering and editing. */
export function RouteEditor({ data, onChanged }: Props) {
  const repos = useRepos();
  const palette = usePalette();
  const [editing, setEditing] = useState<Editing>(null);

  function done() {
    setEditing(null);
    onChanged();
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.intro, { color: palette.textMuted }]}>
        Split your mountain into chunks you can finish in one or two climbs, and give each a time
        estimate. Camps are the milestones along the way.
      </Text>

      {data.camps.map((camp, campIndex) => (
        <View
          key={camp.id}
          style={[styles.camp, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          {editing?.kind === 'camp' && editing.id === camp.id ? (
            <View style={styles.form}>
              <InlineTextForm
                testID="camp-edit"
                initialValue={camp.name}
                placeholder="Camp name"
                saveLabel="Save"
                maxLength={40}
                onCancel={() => setEditing(null)}
                onSave={(name) => {
                  repos.camps.rename(camp.id, name);
                  done();
                }}
              />
              {camp.chunks.length === 0 && data.camps.length > 1 && (
                <Button
                  testID="camp-remove"
                  label="Remove this camp"
                  variant="ghost"
                  onPress={() => {
                    repos.camps.remove(camp.id);
                    done();
                  }}
                />
              )}
            </View>
          ) : (
            <View style={styles.campHeader}>
              <Text style={[styles.campName, { color: palette.text }]}>{camp.name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rename ${camp.name}`}
                onPress={() => setEditing({ kind: 'camp', id: camp.id })}
                style={styles.smallButton}
              >
                <Text style={{ color: palette.accent, fontWeight: '600' }}>Edit</Text>
              </Pressable>
            </View>
          )}

          {camp.chunks.map((chunk, chunkIndex) =>
            editing?.kind === 'chunk' && editing.id === chunk.id ? (
              <ChunkForm
                key={chunk.id}
                testID="chunk-edit"
                initialTitle={chunk.title}
                initialEstimate={chunk.estimateMin}
                onCancel={() => setEditing(null)}
                onSave={(title, estimateMin) => {
                  repos.chunks.update(chunk.id, { title, estimateMin });
                  done();
                }}
                onRemove={
                  chunk.doneAt === null
                    ? () => {
                        repos.chunks.remove(chunk.id);
                        done();
                      }
                    : undefined
                }
              />
            ) : (
              <ChunkRow
                key={chunk.id}
                chunk={chunk}
                // A chunk at the edge of its camp crosses into the next camp, even an
                // empty one. Only the two ends of the whole route cannot move further.
                canMoveUp={campIndex > 0 || chunkIndex > 0}
                canMoveDown={
                  campIndex < data.camps.length - 1 || chunkIndex < camp.chunks.length - 1
                }
                onMove={(direction) => {
                  repos.chunks.move(chunk.id, direction);
                  onChanged();
                }}
                onEdit={() => setEditing({ kind: 'chunk', id: chunk.id })}
              />
            ),
          )}

          {editing?.kind === 'new-chunk' && editing.campId === camp.id ? (
            <ChunkForm
              testID="chunk-new"
              initialTitle=""
              initialEstimate={null}
              onCancel={() => setEditing(null)}
              onSave={(title, estimateMin) => {
                repos.chunks.add(data.mountain.id, title, { campId: camp.id, estimateMin });
                done();
              }}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add a chunk to ${camp.name}`}
              onPress={() => setEditing({ kind: 'new-chunk', campId: camp.id })}
              style={styles.addRow}
            >
              <Text style={{ color: palette.accent, fontWeight: '600' }}>+ Add a chunk</Text>
            </Pressable>
          )}
        </View>
      ))}

      {editing?.kind === 'new-camp' ? (
        <InlineTextForm
          testID="camp-new"
          placeholder="Camp name, e.g. First draft done"
          saveLabel="Add camp"
          maxLength={40}
          onCancel={() => setEditing(null)}
          onSave={(name) => {
            repos.camps.add(data.mountain.id, name);
            done();
          }}
        />
      ) : (
        <Button
          testID="camp-add"
          label="+ Add a camp"
          variant="secondary"
          onPress={() => setEditing({ kind: 'new-camp' })}
        />
      )}
    </View>
  );
}

function ChunkRow(props: {
  chunk: PlanChunk;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: 'up' | 'down') => void;
  onEdit: () => void;
}) {
  const palette = usePalette();
  const { chunk } = props;
  const isDone = chunk.doneAt !== null;

  const arrow = (direction: 'up' | 'down', enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Move ${chunk.title} ${direction}`}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => props.onMove(direction)}
      style={[styles.iconButton, { borderColor: palette.border, opacity: enabled ? 1 : 0.3 }]}
    >
      <Text style={{ color: palette.text, fontSize: 16 }}>{direction === 'up' ? '↑' : '↓'}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.chunk, { borderTopColor: palette.border }]}>
      <Text
        style={[styles.mark, { color: isDone ? palette.success : palette.textMuted }]}
        accessibilityLabel={isDone ? 'Done' : 'Not done'}
      >
        {isDone ? '✓' : '○'}
      </Text>
      <View style={styles.chunkText}>
        <Text style={[styles.chunkTitle, { color: palette.text }]}>{chunk.title}</Text>
        <Text style={{ color: palette.textMuted, fontSize: 13 }}>{describeChunk(chunk)}</Text>
      </View>
      {arrow('up', props.canMoveUp)}
      {arrow('down', props.canMoveDown)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${chunk.title}`}
        onPress={props.onEdit}
        style={styles.smallButton}
      >
        <Text style={{ color: palette.accent, fontWeight: '600' }}>Edit</Text>
      </Pressable>
    </View>
  );
}

function ChunkForm(props: {
  testID: string;
  initialTitle: string;
  initialEstimate: number | null;
  onSave: (title: string, estimateMin: number | null) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const palette = usePalette();
  const [title, setTitle] = useState(props.initialTitle);
  const [estimate, setEstimate] = useState<number | null>(props.initialEstimate);
  const canSave = title.trim().length > 0;

  return (
    <View style={[styles.form, styles.chunkForm, { borderTopColor: palette.border }]}>
      <TextInput
        testID={`${props.testID}-title`}
        accessibilityLabel="Chunk title"
        value={title}
        onChangeText={setTitle}
        placeholder="What is this chunk?"
        placeholderTextColor={palette.textMuted}
        maxLength={80}
        style={[styles.input, { color: palette.text, borderColor: palette.border }]}
      />
      <Text style={{ color: palette.textMuted, fontSize: 13 }}>How long will it take?</Text>
      <View style={styles.estimates} accessibilityRole="radiogroup">
        {ESTIMATE_OPTIONS_MIN.map((minutes) => {
          const selected = estimate === minutes;
          return (
            <Pressable
              key={minutes}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Estimate ${formatMinutes(minutes)}`}
              // Tapping the selected estimate again clears it.
              onPress={() => setEstimate(selected ? null : minutes)}
              style={[
                styles.estimate,
                {
                  backgroundColor: selected ? palette.accent : 'transparent',
                  borderColor: selected ? palette.accent : palette.border,
                },
              ]}
            >
              <Text style={{ color: selected ? palette.onAccent : palette.text, fontSize: 13 }}>
                {formatMinutes(minutes)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.formActions}>
        <Button
          testID={`${props.testID}-cancel`}
          label="Cancel"
          variant="ghost"
          onPress={props.onCancel}
          style={styles.formAction}
        />
        <Button
          testID={`${props.testID}-save`}
          label="Save"
          variant="secondary"
          disabled={!canSave}
          onPress={() => props.onSave(title.trim(), estimate)}
          style={styles.formAction}
        />
      </View>
      {props.onRemove && (
        <Button
          testID={`${props.testID}-remove`}
          label="Remove this chunk"
          variant="ghost"
          onPress={props.onRemove}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  intro: { fontSize: 15, lineHeight: 21 },
  camp: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  campHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  campName: { flex: 1, fontSize: 17, fontWeight: '700' },
  smallButton: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  chunk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mark: { width: 20, fontSize: 16, textAlign: 'center' },
  chunkText: { flex: 1, gap: 2 },
  chunkTitle: { fontSize: 16, fontWeight: '500' },
  iconButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: { minHeight: 48, justifyContent: 'center' },
  form: { gap: 8, paddingVertical: 8 },
  chunkForm: { borderTopWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  estimates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  estimate: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  formActions: { flexDirection: 'row', gap: 8 },
  formAction: { flex: 1, minHeight: 44 },
});
