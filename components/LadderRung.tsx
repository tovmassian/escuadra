import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OutdatedGlyph } from './ActionGlyphs';
import { LockGlyph } from './LockGlyph';
import { A_LA_ESCUADRA } from '@/i18n/names';
import { useT } from '@/i18n/useT';
import { rungAccessibilityLabel, rungTag, unlockHint, type LadderRow } from '@/lib/ladderView';
import {
  borderWidths,
  fontScaleCap,
  iconSize,
  opacity,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface LadderRungProps {
  /** Cleared or locked: the focused level is the card (`LadderCard`). */
  row: LadderRow;
  title: string;
  /** Starts the level. A locked rung ignores it. */
  onPress?: () => void;
}

// A compact rung on Difficulty (#178, spec §1.3): the level number, the title,
// and on the right the best score or, while locked, a padlock and what opens
// it. A rung is only ever cleared or locked, since the first unlocked level is
// the focused card; anything that is not cleared draws as locked. A best set
// before the squad was updated is grey, with a clock and "Outdated" in place
// of the tag (#180).
export function LadderRung({ row, title, onPress }: LadderRungProps) {
  const colors = useThemeColors();
  const t = useT();
  const cleared = row.status === 'cleared' && row.best !== undefined;
  const best = cleared ? row.best : undefined;
  const outdated = best?.outdated === true;
  const escuadra = best !== undefined && !outdated && rungTag(best) === 'escuadra';
  const scoreColor = outdated ? colors.textMuted : colors.textPrimary;
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radii.rung,
      borderWidth: borderWidths.hairline,
      borderColor: colors.hairline,
    },
    // A locked rung has no fill: it sits on the ground.
    filled: { backgroundColor: colors.surface },
    // A fixed width, so every rung's title starts on one line.
    number: {
      ...typography.rungNumber,
      color: best ? colors.textPrimary : colors.textMuted,
      width: sizes.rungNumberColumn,
      textAlign: 'center',
    },
    title: {
      ...typography.rungTitle,
      color: best ? colors.textPrimary : colors.textMuted,
      flex: 1,
    },
    score: { alignItems: 'flex-end', gap: spacing.xxs - 1 },
    best: { ...typography.rungScore, color: escuadra ? colors.successText : scoreColor },
    tail: { ...typography.rungScoreTail, color: escuadra ? colors.successText : colors.textMuted },
    tag: { ...typography.soonChip, color: outdated ? colors.textMuted : colors.successText },
    outdatedTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
    lock: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs - 2 },
    // Shrinks, so a long translated hint wraps instead of crushing the title.
    hint: { ...typography.soonChip, color: colors.textMuted, flexShrink: 1 },
  });

  return (
    <Pressable
      onPress={best ? onPress : undefined}
      disabled={!best}
      accessibilityRole="button"
      accessibilityLabel={rungAccessibilityLabel(row, title, t)}
      accessibilityState={{ disabled: !best }}
      style={({ pressed }) => [
        styles.row,
        best && styles.filled,
        pressed && { opacity: opacity.settled },
      ]}
    >
      <Text style={styles.number} maxFontSizeMultiplier={fontScaleCap.display}>
        {row.level}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {best ? (
        <View style={styles.score}>
          <Text style={styles.best} maxFontSizeMultiplier={fontScaleCap.display}>
            {best.correct}
            <Text style={styles.tail}>/{best.total}</Text>
          </Text>
          {outdated ? (
            <View style={styles.outdatedTag}>
              <OutdatedGlyph color={colors.textMuted} size={iconSize.outdated} />
              <Text style={styles.tag}>{t.common.outdated}</Text>
            </View>
          ) : (
            <Text style={styles.tag}>{escuadra ? A_LA_ESCUADRA : t.ladder.cleared}</Text>
          )}
        </View>
      ) : (
        <View style={styles.lock}>
          <LockGlyph
            size={iconSize.ladderLock}
            color={colors.textMuted}
            ground={colors.background}
          />
          <Text style={styles.hint}>{unlockHint(row.level, t)}</Text>
        </View>
      )}
    </Pressable>
  );
}
