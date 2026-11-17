import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { usePalette } from '@/theme/colors';

import { Button } from './Button';

interface Props {
  initialValue?: string;
  placeholder: string;
  saveLabel: string;
  onSave: (value: string) => void;
  onCancel?: () => void;
  /** Keep the form open and empty after saving, for adding several items in a row. */
  clearOnSave?: boolean;
  maxLength?: number;
  testID: string;
}

/** A one-line text field with a save button, used for adding and renaming things. */
export function InlineTextForm({
  initialValue = '',
  placeholder,
  saveLabel,
  onSave,
  onCancel,
  clearOnSave,
  maxLength = 80,
  testID,
}: Props) {
  const palette = usePalette();
  const [value, setValue] = useState(initialValue);
  const canSave = value.trim().length > 0;

  function save() {
    if (!canSave) return;
    onSave(value.trim());
    if (clearOnSave) setValue('');
  }

  return (
    <View style={styles.form}>
      <TextInput
        testID={`${testID}-input`}
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={save}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        maxLength={maxLength}
        returnKeyType="done"
        style={[
          styles.input,
          { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface },
        ]}
      />
      <View style={styles.actions}>
        {onCancel && (
          <Button
            testID={`${testID}-cancel`}
            label="Cancel"
            variant="ghost"
            onPress={onCancel}
            style={styles.action}
          />
        )}
        <Button
          testID={`${testID}-save`}
          label={saveLabel}
          variant="secondary"
          disabled={!canSave}
          onPress={save}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 44 },
});
