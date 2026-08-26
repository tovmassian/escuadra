import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  badgeSize,
  borderWidths,
  colors,
  difficultyTitleSize,
  difficultyTitleWeight,
  iconSize,
  opacity,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import type { Level } from '@/lib/questionEngine';
import { LockGlyph } from '@/components/LockGlyph';
import { VerdictGlyph } from '@/components/VerdictGlyph';
import { type DifficultyStatus } from '@/lib/ladderView';

export type { DifficultyStatus };

interface DifficultyRowProps {
  level: Level;
  title: string;
  description: string;
  status: DifficultyStatus;
  bestScore?: { correct: number; total: number };
  /** Locked rows only — states what clears the gate. */
  unlockHint?: string;
  onPress?: () => void;
}

// Badge size, card weight, and title size all escalate with level — the
// ladder's "harder" reads as visually heavier, not just numbered.
export function DifficultyRow({
  level,
  title,
  description,
  status,
  bestScore,
  unlockHint,
  onPress,
}: DifficultyRowProps) {
  const locked = status === 'locked';
  const best = status === 'best';
  const size = badgeSize[level];

  return (
    <Pressable
      onPress={onPress}
      disabled={locked || !onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      style={[styles.row, locked && styles.rowLocked]}
    >
      <View style={styles.badgeColumn}>
        <View
          style={[
            styles.badge,
            { width: size, height: size },
            locked && styles.badgeLocked,
            status === 'unlocked' && styles.badgeUnlocked,
            best && styles.badgeBest,
          ]}
        >
          {locked ? (
            <LockGlyph size={Math.round(size * iconSize.lockGlyphRatio)} />
          ) : best ? (
            <VerdictGlyph correct color={colors.accentOn} />
          ) : (
            <Text style={[styles.badgeLabel, { color: colors.accentOn }]}>{level}</Text>
          )}
        </View>
      </View>
      <View style={[styles.card, status === 'unlocked' && styles.cardEmphasis]}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { fontSize: difficultyTitleSize[level], fontWeight: difficultyTitleWeight[level] },
            ]}
          >
            {title}
          </Text>
          {best && bestScore && (
            <View style={styles.statusPillBest}>
              <Text style={styles.statusLabelBest}>
                BEST {bestScore.correct}/{bestScore.total}
              </Text>
            </View>
          )}
          {locked && unlockHint && <Text style={styles.unlockHint}>{unlockHint}</Text>}
        </View>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'center' },
  rowLocked: { opacity: opacity.disabled },
  // Fixed-width slot the badge centres inside, regardless of its own
  // diameter (40-56px, escalating by level) — so all three badges, and the
  // connector segments between them, share one vertical axis.
  badgeColumn: {
    width: sizes.difficultyBadgeColumn,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  badgeLocked: { backgroundColor: colors.surface },
  badgeUnlocked: { backgroundColor: colors.accent, borderColor: colors.accent },
  badgeBest: { backgroundColor: colors.success, borderColor: colors.success },
  badgeLabel: { ...typography.badgeNumber },
  card: {
    flex: 1,
    padding: spacing.md - 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
  cardEmphasis: {
    borderWidth: borderWidths.thick,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: { fontFamily: 'Inter-SemiBold', color: colors.textPrimary },
  description: {
    ...typography.descriptionSmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  statusPillBest: {
    paddingVertical: spacing.xxs - 1,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.successBg,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  statusLabelBest: { ...typography.captionEyebrow, color: colors.success },
  unlockHint: { ...typography.captionEyebrow, color: colors.textMuted, flexShrink: 0 },
});
