import { StyleSheet, Text, View } from 'react-native';
import { ClockGlyph } from './SettingsGlyphs';
import { SoonChip } from './SoonChip';
import { useT } from '@/i18n/useT';
import { borderWidths, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Exam mode on Difficulty (#178, spec §1.4), under the ladder. Exam mode is a
// placeholder for the standalone feature beside the ladder, not a fourth
// level: dashed, unnumbered and not pressable, with the SOON chip as Settings'
// Coming next draws it. One screen-reader stop, as there.
export function ExamModeRow() {
  const colors = useThemeColors();
  const t = useT();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + spacing.nudge,
      padding: spacing.md,
      borderRadius: radii.rung,
      borderWidth: borderWidths.thick,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    text: { flex: 1, gap: spacing.xxs - spacing.hair },
    title: { ...typography.settingsLabel, color: colors.textSecondary },
    line: { ...typography.secondarySmall, color: colors.textMuted },
  });

  return (
    <View accessible style={styles.row}>
      <ClockGlyph color={colors.textMuted} />
      <View style={styles.text}>
        <Text style={styles.title}>{t.examMode.title}</Text>
        <Text style={styles.line}>{t.examMode.line}</Text>
      </View>
      <SoonChip label={t.examMode.soon} />
    </View>
  );
}
