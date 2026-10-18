import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Flag } from './Flag';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import { slotSpoken, slotValueText, type Slot, type SlotState } from '@/lib/roundView';
import {
  borderWidths,
  durations,
  radii,
  sizes,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
  type Palette,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

function look(colors: Palette, state: SlotState): { line: string; text: string; dashed: boolean } {
  switch (state) {
    case 'active':
      return { line: colors.accentLine, text: colors.onStage, dashed: false };
    case 'pending':
      return { line: colors.chipPendingLine, text: colors.chipPendingText, dashed: true };
    case 'correct':
      return { line: colors.success, text: colors.stageSuccessText, dashed: false };
    case 'wrong':
      return { line: colors.error, text: colors.onStage, dashed: false };
    case 'notAsked':
      return { line: colors.chipLine, text: colors.chipPendingText, dashed: false };
    case 'given':
      return { line: colors.chipLine, text: colors.onStage, dashed: false };
  }
}

// One chip under the shirt number (spec §2.2).
// - A clue prints its value.
// - An asked part shows `?` while asked and `—` while it waits; it fills in
//   once answered (green outline when right; the right value with a red
//   outline when wrong).
// - After a miss, the later parts show their value, muted.
// A slot being asked carries no value at all (`slotStates`), so nothing here
// can show or speak the answer early.
export function SlotChip({ slot }: { slot: Slot }) {
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(slot.state);

  // The next part's outline pulses as it becomes active (spec §6).
  useEffect(() => {
    const from = previous.current;
    previous.current = slot.state;
    if (reduced || slot.state !== 'active' || from === 'active') return;
    const half = durations.pulse / 2;
    scale.value = withSequence(
      withTiming(spotlightMotion.pulseScale, { duration: half }),
      withTiming(1, { duration: half }),
    );
  }, [slot.state, reduced, scale]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { line, text, dashed } = look(colors, slot.state);
  const valueText = slotValueText(slot, language, t);
  const shown = valueText ?? (slot.state === 'active' ? '?' : '—');
  const flag = slot.key === 'NAT' && slot.value !== null ? flagFor(slot.value) : null;
  const settled = slot.state === 'correct' || slot.state === 'wrong';
  const styles = StyleSheet.create({
    chip: {
      minHeight: sizes.slotChipHeight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderStyle: dashed ? 'dashed' : 'solid',
      borderColor: line,
      backgroundColor: colors.chipBg,
    },
    label: { ...typography.captionEyebrow, color: colors.onStageMuted },
    value: { ...typography.slotValue, color: text },
  });

  return (
    <Animated.View
      style={[styles.chip, pulse]}
      accessible
      accessibilityLabel={slotSpoken(slot, language, t)}
    >
      <Text style={styles.label}>{t.slotCodes[slot.key]}</Text>
      {flag ? <Flag code={flag} size="inline" label={valueText ?? ''} /> : null}
      <Animated.Text
        key={`${slot.state}:${shown}`}
        entering={
          settled
            ? FadeIn.duration(durations.reveal).delay(reduced ? 0 : spotlightCues.slot)
            : undefined
        }
        style={styles.value}
        numberOfLines={1}
      >
        {shown}
      </Animated.Text>
    </Animated.View>
  );
}
