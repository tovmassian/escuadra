import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { OutdatedGlyph } from './ActionGlyphs';
import { Flag } from './Flag';
import { ChevronGlyph } from './SettingsGlyphs';
import { TeamMarker } from './TeamMarker';
import type { FlagCode } from '@/assets/flags/generated';
import { useT } from '@/i18n/useT';
import { scoreBlock, scoreSpoken, type TeamProgress } from '@/lib/pickerView';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import {
  borderWidths,
  fontScaleCap,
  iconSize,
  opacity,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
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
  /** `'card'`: a row in Your squads' card (#179), a little taller, with no
   *  divider under the card's last row. */
  variant?: 'list' | 'card';
  last?: boolean;
  /** The row's own view: the picker's second How to play tip rings it (#183). */
  ref?: Ref<ViewInstance>;
}

// A picker row (#176): the marker at 40 × 27, the name, and on the right the
// best of the highest level played, or a chevron when the team is unplayed.
// A best set before the squad was updated is grey, under a clock and
// "Outdated" in place of the level (#180).
export function TeamRow({
  name,
  marker,
  flag,
  progress,
  onPress,
  variant = 'list',
  last = false,
  ref,
}: TeamRowProps) {
  const colors = useThemeColors();
  const t = useT();
  const block = scoreBlock(progress);
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + spacing.nudge,
      minHeight: variant === 'card' ? sizes.pickerCardRow : sizes.pickerRow,
      borderBottomWidth: variant === 'card' && last ? 0 : borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    name: { ...typography.teamName, color: colors.textPrimary, flex: 1, minWidth: 0 },
    score: { alignItems: 'flex-end', gap: spacing.nudge },
    label: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
    level: { ...typography.rowLevel, color: colors.textMuted },
    best: { ...typography.rowScore, color: colors.textPrimary },
    tail: { ...typography.rowScoreTail, color: colors.textMuted },
  });
  const outdated = block.kind === 'played' && block.outdated;
  // Only a current 10/10 turns green: an outdated one is grey like the rest.
  const bestColor = outdated
    ? colors.textMuted
    : block.kind === 'played' && block.flawless
      ? colors.successText
      : colors.textPrimary;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={scoreSpoken(name, block, t)}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.settled }]}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {flag ? (
          <Flag code={flag} size="picker" label={name} />
        ) : (
          <TeamMarker marker={marker} variant="picker" />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.display}>
        {name}
      </Text>
      {block.kind === 'played' && (
        <View style={styles.score}>
          {outdated ? (
            <View style={styles.label}>
              <OutdatedGlyph color={colors.textMuted} size={iconSize.outdated} />
              <Text style={styles.level}>{t.common.outdated}</Text>
            </View>
          ) : (
            <Text style={styles.level}>{t.common.level(block.level)}</Text>
          )}
          <Text
            style={[styles.best, { color: bestColor }]}
            maxFontSizeMultiplier={fontScaleCap.display}
          >
            {block.correct}
            {/* "/10" stays muted even at 10/10: only the score turns green. */}
            <Text style={styles.tail}>/{block.total}</Text>
          </Text>
        </View>
      )}
      {block.kind === 'unplayed' && <ChevronGlyph color={colors.textMuted} />}
    </Pressable>
  );
}
