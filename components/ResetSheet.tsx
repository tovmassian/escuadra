import { Sheet } from '@/components/Sheet';
import { useT } from '@/i18n/useT';
import {
  borderWidths,
  fontScaleCap,
  opacity,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface ResetSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Names the sheet `<testID>-sheet`, its close `<testID>-close`, its button `<testID>-confirm`. */
  testID: string;
  title: string;
  line: string;
  /** The Clears list: a label, and a mono value on the right when there is one. */
  clears: readonly { label: string; value?: string }[];
  /** The Keeps line; none when nothing worth saying is kept. */
  keeps?: string;
  confirmLabel: string;
  onConfirm: () => void;
}

// The confirmation every reset shares (#197): what it clears, what it keeps,
// and a destructive button. No Cancel: the sheet's ×, the backdrop and
// Android's back already close it.
export function ResetSheet({
  visible,
  onClose,
  testID,
  title,
  line,
  clears,
  keeps,
  confirmLabel,
  onConfirm,
}: ResetSheetProps) {
  const colors = useThemeColors();
  const t = useT();

  const styles = StyleSheet.create({
    // Shrinks, and scrolls, when the sheet is capped: at the largest text the
    // confirm stays whole under it.
    body: { flexShrink: 1 },
    bodyContent: { gap: spacing.md },
    line: { ...typography.secondary, color: colors.textSecondary },
    heading: { ...typography.monoCaption, color: colors.textMuted },
    section: { gap: spacing.xs },
    // The rows sit a hairline apart on the sheet's own colour, which draws the divider.
    card: {
      borderRadius: radii.md,
      overflow: 'hidden',
      gap: borderWidths.hairline,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceRaised,
    },
    label: { ...typography.settingsLabel, color: colors.textPrimary, flexShrink: 1 },
    value: {
      ...typography.statMonoTiny,
      color: colors.textSecondary,
      flexShrink: 1,
      textAlign: 'right',
    },
    keeps: { ...typography.secondarySmall, color: colors.textSecondary },
    confirm: {
      minHeight: sizes.cta.normal,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: sizes.cta.normal / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.error,
    },
    confirmText: { ...typography.ctaLabel, color: colors.dangerOn, textAlign: 'center' },
  });

  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID={testID}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.line}>{line}</Text>

        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {t.reset.clears}
          </Text>
          <View style={styles.card}>
            {clears.map((item) => (
              // One stop per row for a screen reader, its value with it (#187).
              <View
                key={item.label}
                style={styles.row}
                accessible
                accessibilityLabel={[item.label, item.value].filter(Boolean).join(', ')}
              >
                <Text style={styles.label}>{item.label}</Text>
                {item.value ? <Text style={styles.value}>{item.value}</Text> : null}
              </View>
            ))}
          </View>
        </View>

        {keeps ? (
          <View style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {t.reset.keeps}
            </Text>
            <Text style={styles.keeps}>{keeps}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        testID={`${testID}-confirm`}
        onPress={() => {
          onConfirm();
          onClose();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.confirm, pressed && { opacity: opacity.settled }]}
      >
        <Text style={styles.confirmText} maxFontSizeMultiplier={fontScaleCap.button}>
          {confirmLabel}
        </Text>
      </Pressable>
    </Sheet>
  );
}
