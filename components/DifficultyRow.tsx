import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  badgeSize,
  colors,
  difficultyTitleSize,
  difficultyTitleWeight,
  opacity,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';
import type { Level } from '@/lib/questionEngine';

export type DifficultyStatus = 'best' | 'unlocked' | 'locked';

interface DifficultyRowProps {
  level: Level;
  title: string;
  description: string;
  status: DifficultyStatus;
  bestScore?: { correct: number; total: number };
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
  onPress,
}: DifficultyRowProps) {
  const locked = status === 'locked';
  const size = badgeSize[level];

  return (
    <Pressable
      onPress={onPress}
      disabled={locked || !onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      style={styles.row}
    >
      <View
        style={[
          styles.badge,
          { width: size, height: size, borderColor: locked ? colors.border : colors.accent },
        ]}
      >
        <Text
          style={[styles.badgeLabel, { color: locked ? colors.textMuted : colors.textPrimary }]}
        >
          {level}
        </Text>
      </View>
      <View
        style={[
          styles.card,
          status === 'unlocked' && styles.cardRaised,
          level === 3 && styles.cardEmphasis,
          locked && styles.cardLocked,
        ]}
      >
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { fontSize: difficultyTitleSize[level], fontWeight: difficultyTitleWeight[level] },
            ]}
          >
            {title}
          </Text>
          <StatusPill status={status} bestScore={bestScore} />
        </View>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

function StatusPill({
  status,
  bestScore,
}: {
  status: DifficultyStatus;
  bestScore?: { correct: number; total: number };
}) {
  if (status === 'best' && bestScore) {
    return (
      <View style={styles.statusPillBest}>
        <Text style={styles.statusLabelBest}>
          BEST {bestScore.correct}/{bestScore.total}
        </Text>
      </View>
    );
  }
  return (
    <Text style={styles.statusLabelMuted}>{status === 'locked' ? '🔒 LOCKED' : 'UNLOCKED'}</Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'flex-start' },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  badgeLabel: { ...typography.badgeNumber },
  card: {
    flex: 1,
    padding: spacing.md - 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
  cardRaised: { backgroundColor: colors.surfaceRaised },
  cardEmphasis: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  cardLocked: { opacity: opacity.disabled },
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
  statusLabelMuted: { ...typography.captionEyebrow, color: colors.textMuted, flexShrink: 0 },
});
