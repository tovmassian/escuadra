import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flag } from './Flag';
import { ChevronGlyph } from './SettingsGlyphs';
import { TeamMarker } from './TeamMarker';
import type { FlagCode } from '@/assets/flags/generated';
import { useT } from '@/i18n/useT';
import { scoreBlock, type TeamProgress } from '@/lib/pickerView';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { borderWidths, opacity, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface TeamRowProps {
  name: string;
  marker: TeamMarkerData;
  /** A nation's flag, in place of the bands; never for a club (guardrail 2).
   *  Null when lib/flags.ts has no flag for it: the row falls back to the bands. */
  flag?: FlagCode | null;
  /** `undefined` while the store hydrates, `null` when never played. */
  progress: TeamProgress | null | undefined;
  onPress: () => void;
}

// A picker row (#176): the marker at 40 × 27, the name, and on the right the
// best of the highest level played, or a chevron when the team is unplayed.
export function TeamRow({ name, marker, flag, progress, onPress }: TeamRowProps) {
  const colors = useThemeColors();
  const t = useT();
  const block = scoreBlock(progress);
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      minHeight: sizes.pickerRow,
      borderBottomWidth: borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    name: { ...typography.teamName, color: colors.textPrimary, flex: 1, minWidth: 0 },
    score: { alignItems: 'flex-end', gap: spacing.xxs / 2 },
    level: { ...typography.rowLevel, color: colors.textMuted, textTransform: 'uppercase' },
    best: { ...typography.rowScore, color: colors.textPrimary },
    tail: { ...typography.rowScoreTail, color: colors.textMuted },
  });
  const spoken =
    block.kind === 'played'
      ? `${name}, ${t.picker.bestSpoken(block.level, block.correct, block.total)}`
      : name;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.settled }]}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {flag ? (
          <Flag code={flag} size="picker" label={name} />
        ) : (
          <TeamMarker marker={marker} variant="picker" />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {block.kind === 'played' && (
        <View style={styles.score}>
          <Text style={styles.level}>{t.common.level(block.level)}</Text>
          <Text style={[styles.best, block.flawless && { color: colors.successText }]}>
            {block.correct}
            <Text style={[styles.tail, block.flawless && { color: colors.successText }]}>
              /{block.total}
            </Text>
          </Text>
        </View>
      )}
      {block.kind === 'unplayed' && <ChevronGlyph color={colors.textMuted} />}
    </Pressable>
  );
}
