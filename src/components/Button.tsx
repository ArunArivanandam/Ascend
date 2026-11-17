import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { usePalette } from '@/theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled, testID, style }: Props) {
  const palette = usePalette();
  const background =
    variant === 'primary' ? palette.accent : variant === 'danger' ? palette.danger : 'transparent';
  const color =
    variant === 'primary' || variant === 'danger'
      ? palette.onAccent
      : variant === 'ghost'
        ? palette.textMuted
        : palette.text;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'secondary' && { borderWidth: 1.5, borderColor: palette.border },
        style,
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 17, fontWeight: '600' },
});
