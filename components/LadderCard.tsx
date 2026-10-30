import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { OutdatedGlyph, PlayGlyph } from './ActionGlyphs';
import { useT } from '@/i18n/useT';
import { isEscuadra, playLevelLabel, statusLine, type LadderRow } from '@/lib/ladderView';
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

interface LadderCardProps {
  row: LadderRow;
  title: string;
  /** What the level asks: `levelDescription`. */
  description: string;
  onPlay: () => void;
  /** Play's own view: Difficulty's first How to play tip rings it (#183). */
  playRef?: Ref<ViewInstance>;
}

// The focused rung on Difficulty (#178, spec §1.3): the level to play next.
// Its number carries the escuadra corner, static here; beside it are the
// best score so far, the title and what the level asks, and under them Play.
// A best set before the squad was updated reads grey, after a clock (#180).
// A current 10/10 draws the outline, the corner and the status line green.
export function LadderCard({ row, title, description, onPlay, playRef }: LadderCardProps) {
  const colors = useThemeColors();
  const t = useT();
  const corner = sizes.corner.ladder;
  const status = statusLine(row, t);
  const outdated = row.best?.outdated === true;
  // A current 10/10 here means the squad is done: the card turns green (#181).
  const line = isEscuadra(row) ? colors.success : colors.accentLine;
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: borderWidths.thick,
      borderColor: line,
      borderRadius: radii.ladderCard,
      padding: spacing.md + spacing.nudge,
      gap: spacing.md + spacing.nudge,
    },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    numberBox: { paddingRight: corner.arm + spacing.nudge },
    number: { ...typography.ladderCardNumber, color: colors.textPrimary },
    corner: {
      position: 'absolute',
      right: 0,
      top: spacing.xxs,
      width: corner.arm,
      height: corner.arm,
      borderTopWidth: corner.bar,
      borderRightWidth: corner.bar,
      borderColor: line,
    },
    text: { flex: 1, gap: spacing.xs, paddingTop: spacing.xxs },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs + spacing.hair },
    status: {
      ...typography.ladderCardStatus,
      color: outdated ? colors.textMuted : isEscuadra(row) ? colors.successText : colors.accentLine,
      flexShrink: 1,
    },
    title: { ...typography.ladderCardTitle, color: colors.textPrimary },
    description: { ...typography.ladderCardDescription, color: colors.textSecondary },
    play: {
      minHeight: sizes.ladderPill,
      borderRadius: sizes.ladderPill / 2,
      backgroundColor: colors.ctaBg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + spacing.nudge,
      // Room at the ends, and a label that wraps rather than runs past them at
      // the largest text (#187, J5).
      paddingHorizontal: spacing.md,
    },
    playLabel: {
      ...typography.ladderPlay,
      color: colors.ctaText,
      flexShrink: 1,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {/* The level is in the Play button's name, so the number is hidden. */}
        <View
          style={styles.numberBox}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.number} maxFontSizeMultiplier={fontScaleCap.display}>
            {row.level}
          </Text>
          <View style={styles.corner} />
        </View>
        <View style={styles.text}>
          <View style={styles.statusRow}>
            {outdated && <OutdatedGlyph color={colors.textMuted} size={iconSize.outdatedCard} />}
            <Text style={styles.status} accessibilityLabel={status.spoken}>
              {status.text}
            </Text>
          </View>
          <Text
            style={styles.title}
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleCap.display}
          >
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <Pressable
        ref={playRef}
        testID={`play-level-${row.level}`}
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={playLevelLabel(row.level, t)}
        style={({ pressed }) => [styles.play, pressed && { opacity: opacity.settled }]}
      >
        <PlayGlyph color={colors.ctaText} />
        <Text style={styles.playLabel} maxFontSizeMultiplier={fontScaleCap.button}>
          {playLevelLabel(row.level, t)}
        </Text>
      </Pressable>
    </View>
  );
}
