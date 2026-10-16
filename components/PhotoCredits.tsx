import { PhotoCreditText } from '@/components/PhotoCreditText';
import { Sheet } from '@/components/Sheet';
import type { PhotoCreditRow } from '@/lib/photos';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Every photo the round or the squad showed, with its credit. "Photo credits ·
// N" sits quietly under the screen's own content, so it never competes with
// the results' actions, and opens the list in a sheet: as tall as the list,
// scrolling only past the screen's height, so no credit is cut off below the
// fold. Player names are already revealed on Results, so naming them there
// gives nothing away. Study passes `numbersOnly`, so a row reads "16", not
// "16 Rodri": a name there would spoil Hide names.
export function PhotoCredits({
  rows,
  numbersOnly = false,
}: {
  rows: PhotoCreditRow[];
  numbersOnly?: boolean;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  const styles = StyleSheet.create({
    root: { marginTop: spacing.md },
    // Centred under the actions.
    button: { alignSelf: 'center' },
    label: { ...typography.captionEyebrow, color: colors.textMuted },
    // Shrinks, and scrolls, when the sheet is capped.
    list: { flexShrink: 1 },
    listContent: { gap: spacing.sm },
    row: { ...typography.secondarySmall, color: colors.textMuted },
    name: { color: colors.textPrimary },
    link: { color: colors.textSecondary, textDecorationLine: 'underline' },
  });

  return (
    <View style={styles.root}>
      <Pressable
        testID="photo-credits"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.button}
      >
        <Text style={styles.label}>Photo credits · {rows.length}</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Photo credits" testID="credits">
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          alwaysBounceVertical={false}
        >
          {rows.map((r) => (
            <Text key={r.playerId} style={styles.row}>
              <Text style={styles.name}>
                {r.memberNo ?? '—'}
                {numbersOnly ? '' : ` ${r.playerName}`}
              </Text>
              {' — '}
              <PhotoCreditText credit={r.credit} linkStyle={styles.link} />
            </Text>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}
