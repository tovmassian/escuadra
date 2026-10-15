import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { AnswerTile } from './AnswerTile';
import type { FlagCode } from '@/assets/flags/generated';
import { flagFor } from '@/lib/flags';
import type { QuestionPart } from '@/lib/questionEngine';
import { positionLabel, tileVerdict, type AnswerLayout } from '@/lib/roundView';
import { durations, spacing, spotlightMotion } from '@/theme/tokens';

interface AnswerGridProps {
  part: QuestionPart;
  /** Changes per question and part, so the grid remounts. The old tiles fade
   *  out and the new ones rise in, one after another (spec §6). */
  gridKey: string;
  answeredIndex: number | null;
  layout: AnswerLayout;
  /** Delay between tiles rising in: `durations.tileStagger` for a new
   *  question, `durations.partStagger` for the next part. */
  stagger: number;
  onAnswer: (index: number) => void;
}

interface TileModel {
  index: number;
  label: string;
  sub: string | undefined;
  flag: FlagCode | null | undefined;
}

function rising(reduced: boolean, delay: number) {
  if (reduced) return FadeIn.duration(durations.transition);
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: spotlightMotion.rise }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(durations.transition)
    .delay(delay);
}

// The answers, as a grid (spec §2.3): two columns for names, clubs and
// nationalities, four for positions. Its height is fixed by `answerLayout`.
export function AnswerGrid({
  part,
  gridKey,
  answeredIndex,
  layout,
  stagger,
  onAnswer,
}: AnswerGridProps) {
  const reduced = useReducedMotion();
  const tiles: TileModel[] =
    part.kind === 'position'
      ? part.options.map((option, index) => ({
          index,
          label: option,
          sub: positionLabel(option),
          flag: undefined,
        }))
      : part.options.map((option, index) => ({
          index,
          label: option,
          sub: undefined,
          flag: part.kind === 'nationality' ? flagFor(option) : undefined,
        }));
  const rows: TileModel[][] = [];
  for (const tile of tiles) {
    const r = Math.floor(tile.index / layout.columns);
    (rows[r] ??= []).push(tile);
  }
  const pickedRight = answeredIndex === part.correctIndex;

  return (
    <Animated.View key={gridKey} exiting={FadeOut.duration(durations.partOut)} style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((tile) => (
            <Animated.View
              key={tile.label}
              style={styles.cell}
              entering={rising(reduced, tile.index * stagger)}
            >
              <AnswerTile
                label={tile.label}
                sub={tile.sub}
                flag={tile.flag}
                verdict={tileVerdict(part, answeredIndex, tile.index)}
                pickedRight={pickedRight}
                height={layout.tileHeight}
                onPress={() => onAnswer(tile.index)}
              />
            </Animated.View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  cell: { flex: 1 },
});
