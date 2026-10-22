import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderWidths, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Settings' blocks (#175): a label in IBM Plex Mono capitals over a card, and the rows
// inside one. A row is a button when it has `onPress`; otherwise it only lays out.
export function SettingsSection({
  label,
  dashed = false,
  children,
}: {
  label: string;
  dashed?: boolean;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    section: { gap: spacing.xs },
    label: { ...typography.monoCaption, color: colors.textMuted },
    card: dashed
      ? {
          borderRadius: radii.settingsCard,
          borderWidth: borderWidths.thick,
          borderStyle: 'dashed',
          borderColor: colors.border,
        }
      : {
          borderRadius: radii.settingsCard,
          backgroundColor: colors.surface,
          borderWidth: borderWidths.hairline,
          borderColor: colors.hairline,
          overflow: 'hidden',
        },
  });
  return (
    <View style={styles.section}>
      <Text style={styles.label} accessibilityRole="header">
        {label}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  note,
  accessory,
  onPress,
  testID,
  accessibilityLabel,
  last = false,
  minHeight = sizes.settings.row,
  muted = false,
  textHidden = false,
}: {
  icon: ReactNode;
  label: string;
  note?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  last?: boolean;
  minHeight?: number;
  /** Coming next's quieter text. */
  muted?: boolean;
  /** A switch row is one screen-reader stop, the Switch, which carries the label and
   * the note itself: the row's own text is hidden from it. */
  textHidden?: boolean;
}) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      minHeight,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: last ? 0 : borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    text: { flex: 1, minWidth: 0, gap: spacing.xxs - 1 },
    label: {
      ...typography.settingsLabel,
      color: muted ? colors.textSecondary : colors.textPrimary,
    },
    note: { ...typography.secondarySmall, color: colors.textMuted },
  });
  const body = (
    <>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {icon}
      </View>
      <View
        style={styles.text}
        importantForAccessibility={textHidden ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={textHidden}
      >
        <Text style={styles.label}>{label}</Text>
        {note !== undefined && <Text style={styles.note}>{note}</Text>}
      </View>
      {accessory}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.settled }]}
    >
      {body}
    </Pressable>
  );
}
