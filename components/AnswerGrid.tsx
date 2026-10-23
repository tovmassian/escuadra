import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import { AnswerTile } from './AnswerTile';
import { riseIn } from './riseIn';
import type { ShotTap } from './useShot';
import type { FlagCode } from '@/assets/flags/generated';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import type { QuestionPart } from '@/lib/questionEngine';
import { optionText, positionLabel, tileVerdict, type AnswerLayout } from '@/lib/roundView';
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
  /** The answer, and where it was tapped (the shot starts from there). */
  onAnswer: (index: number, tap: ShotTap) => void;
}

interface TileModel {
  index: number;
  label: string;
  sub: string | undefined;
  flag: FlagCode | null | undefined;
  testID: string | undefined;
}

// The answers, as a grid (spec §2.3): two columns for names, clubs and
// nationalities, four for positions. Its height is fixed by `answerLayout`. It
// fills its parent's width: the question screen sets the inset.
export function AnswerGrid({
  part,
  gridKey,
  answeredIndex,
  layout,
  stagger,
  onAnswer,
}: AnswerGridProps) {
  const reduced = useReducedMotion();
  const t = useT();
  const language = useLanguage();
  // The grid whose tiles may be pressed. The next part's tiles sit in the same
  // spot as the ones just answered, so a double tap or a bounce would answer
  // them as well. Presses are ignored until the old tiles have faded
  // (`durations.partOut`); the tiles do not look disabled.
  const readyGrid = useRef<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      readyGrid.current = gridKey;
    }, durations.partOut);
    return () => clearTimeout(timer);
  }, [gridKey]);
  const tiles: TileModel[] =
    part.kind === 'position'
      ? part.options.map((option, index) => ({
          index,
          label: optionText(part, index, language, t),
          sub: positionLabel(option, t),
          flag: undefined,
          testID: `answer-position-${option}`,
        }))
      : part.options.map((option, index) => ({
          index,
          label: optionText(part, index, language, t),
          sub: undefined,
          flag: part.kind === 'nationality' ? flagFor(option) : undefined,
          testID: undefined,
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
              entering={riseIn(
                reduced,
                spotlightMotion.rise,
                durations.transition,
                tile.index * stagger,
              )}
            >
              <AnswerTile
                label={tile.label}
                sub={tile.sub}
                flag={tile.flag}
                testID={tile.testID}
                verdict={tileVerdict(part, answeredIndex, tile.index)}
                pickedRight={pickedRight}
                minHeight={layout.tileHeight}
                onPress={(tap) => {
                  if (readyGrid.current === gridKey) onAnswer(tile.index, tap);
                }}
              />
            </Animated.View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  cell: { flex: 1 },
});
