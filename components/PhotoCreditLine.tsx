import { PhotoCreditText } from '@/components/PhotoCreditText';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { PhotoCredit } from '@/types/squad';
import { StyleSheet, Text } from 'react-native';

// A photo's credit, under the question's action button for as long as the
// question is on screen — never part of the answer reveal (spec §8.4; the
// play-page redesign may move it). Author and licence only — never the file
// name or caption, which name the player. Quiet on purpose: muted text, so it
// is always there to read without competing with the answers.
//
// It always takes two lines — the common "Bryan Berlin / WikiPortraits ·
// CC BY-SA 4.0" credit wraps at phone width — with a photo or without, so the
// button above does not jump from one question to the next.
const LINE_HEIGHT = Math.round(typography.descriptionSmall.fontSize * 1.3);

export function PhotoCreditLine({ credit }: { credit: PhotoCredit | null }) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    line: {
      ...typography.descriptionSmall,
      lineHeight: LINE_HEIGHT,
      minHeight: LINE_HEIGHT * 2,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    link: { textDecorationLine: 'underline' },
  });

  if (credit === null) {
    return (
      <Text style={styles.line} accessible={false} importantForAccessibility="no">
        {' '}
      </Text>
    );
  }

  return (
    <Text style={styles.line} numberOfLines={2}>
      Photo: <PhotoCreditText credit={credit} linkStyle={styles.link} />
    </Text>
  );
}
