import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n/useT';
import { borderWidths, fontScaleCap, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export type Kind = 'club' | 'nation';

interface KindTabsProps {
  value: Kind;
  counts: Record<Kind, number>;
  onChange: (kind: Kind) => void;
}

const KINDS: readonly Kind[] = ['club', 'nation'];

// The picker's Clubs / Nations switch (#176): two tabs on a pill track, each
// with the number of teams behind it.
export function KindTabs({ value, counts, onChange }: KindTabsProps) {
  const colors = useThemeColors();
  const t = useT();
  const styles = StyleSheet.create({
    track: {
      flexDirection: 'row',
      gap: spacing.xxs,
      padding: spacing.xxs,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.hairline,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      height: sizes.pickerTab,
      borderRadius: radii.pill,
    },
    tabSelected: { backgroundColor: colors.ctaBg },
    // A label too wide for its tab gives way with an ellipsis; the count keeps
    // its width.
    label: { ...typography.tabLabel, color: colors.textSecondary, flexShrink: 1 },
    labelSelected: { color: colors.ctaText },
    count: { ...typography.statMonoTiny, color: colors.textMuted, flexShrink: 0 },
    countSelected: { color: colors.ctaMuted },
  });
  const labels: Record<Kind, string> = { club: t.picker.clubs, nation: t.picker.nations };

  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {KINDS.map((kind) => {
        const selected = value === kind;
        return (
          <Pressable
            key={kind}
            testID={`kind-${kind}`}
            onPress={() => onChange(kind)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            accessibilityLabel={[labels[kind], counts[kind]].join(', ')}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            {/* The tab is a fixed `sizes.pickerTab` tall, so its text stays on
                one line and grows only to the display cap: a wrapped
                "SELECCIONES 157" would be clipped. */}
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              numberOfLines={1}
              maxFontSizeMultiplier={fontScaleCap.display}
            >
              {labels[kind]}
            </Text>
            <Text
              style={[styles.count, selected && styles.countSelected]}
              numberOfLines={1}
              maxFontSizeMultiplier={fontScaleCap.display}
            >
              {counts[kind]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
