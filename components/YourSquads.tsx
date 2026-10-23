import { StyleSheet, Text, View } from 'react-native';
import { StarGlyph } from './ActionGlyphs';
import { useT } from '@/i18n/useT';
import { borderWidths, iconSize, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { ReactNode } from 'react';

// The picker's Your squads group (#179): a starred caption over a card of the
// tab's starred teams. The screen gives it the rows, `TeamRow`s in their card
// variant, and leaves it out when there are none.
export function YourSquads({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const t = useT();
  const styles = StyleSheet.create({
    group: { gap: spacing.xs + 2, marginTop: spacing.xxs + 2, marginBottom: spacing.md + 2 },
    caption: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs + 2 },
    label: { ...typography.monoCaption, color: colors.textMuted },
    card: {
      borderRadius: radii.squadsCard,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.hairline,
      paddingHorizontal: spacing.md,
    },
  });
  return (
    <View testID="your-squads" style={styles.group}>
      <View style={styles.caption}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <StarGlyph color={colors.textMuted} filled size={iconSize.starCaption} />
        </View>
        <Text style={styles.label} accessibilityRole="header">
          {t.picker.yourSquads}
        </Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}
