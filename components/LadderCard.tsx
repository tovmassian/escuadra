import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OutdatedGlyph, PlayGlyph } from './ActionGlyphs';
import { useT } from '@/i18n/useT';
import { playLevelLabel, statusLine, type LadderRow } from '@/lib/ladderView';
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
}

// The focused rung on Difficulty (#178, spec §1.3): the level to play next.
// Its number carries the escuadra corner, static here; beside it are the
// best score so far, the title and what the level asks, and under them Play.
// A best set before the squad was updated reads grey, after a clock (#180).
export function LadderCard({ row, title, description, onPlay }: LadderCardProps) {
  const colors = useThemeColors();
  const t = useT();
  const corner = sizes.corner.ladder;
  const status = statusLine(row, t);
  const outdated = row.best?.outdated === true;
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: borderWidths.thick,
      borderColor: colors.accentLine,
      borderRadius: radii.ladderCard,
      padding: spacing.md + 2,
      gap: spacing.md + 2,
    },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    numberBox: { paddingRight: corner.arm + spacing.xxs / 2 },
    number: { ...typography.ladderCardNumber, color: colors.textPrimary },
    corner: {
      position: 'absolute',
      right: 0,
      top: spacing.xxs,
      width: corner.arm,
      height: corner.arm,
      borderTopWidth: corner.bar,
      borderRightWidth: corner.bar,
      borderColor: colors.accentLine,
    },
    text: { flex: 1, gap: spacing.xs, paddingTop: spacing.xxs },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs + 1 },
    status: {
      ...typography.ladderCardStatus,
      color: outdated ? colors.textMuted : colors.accentLine,
      flexShrink: 1,
    },
    title: { ...typography.ladderCardTitle, color: colors.textPrimary },
    description: { ...typography.ladderCardDescription, color: colors.textSecondary },
    play: {
      minHeight: sizes.ladderPill,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 2,
    },
    playLabel: { ...typography.ladderPlay, color: colors.ctaText },
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
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <Pressable
        testID={`play-level-${row.level}`}
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={playLevelLabel(row.level, t)}
        style={({ pressed }) => [styles.play, pressed && { opacity: opacity.settled }]}
      >
        <PlayGlyph color={colors.ctaText} />
        <Text style={styles.playLabel}>{playLevelLabel(row.level, t)}</Text>
      </Pressable>
    </View>
  );
}
