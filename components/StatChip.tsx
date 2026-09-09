import { StyleSheet, Text, View } from 'react-native';
import { Flag } from './Flag';
import type { FlagCode } from '@/assets/flags/generated';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface StatChipProps {
  label: string;
  value: string;
  /** Set only on the `NAT` chip, where the value is a nationality. Null when
   *  that nationality isn't in lib/flags.ts's table. The `CLUB` chip never
   *  passes one — a club has no flag. */
  flag?: FlagCode | null;
}

export function StatChip({ label, value, flag }: StatChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
      {flag ? <Flag code={flag} size="inline" label={value} /> : null}
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
    paddingVertical: spacing.xs - 1,
    paddingHorizontal: spacing.sm + 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  label: { ...typography.captionEyebrow, color: colors.textMuted },
  value: { ...typography.statMonoTiny, color: colors.textPrimary },
});
