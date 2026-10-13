import type { PhotoCreditRow } from '@/lib/photos';
import { sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Every photo the round showed, with its credit. Collapsed by
// default so it never competes with the results' own actions. Player names are
// already revealed on this screen, so naming them here gives nothing away.
export function PhotoCredits({ rows }: { rows: PhotoCreditRow[] }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  const styles = StyleSheet.create({
    root: { marginTop: spacing.md, gap: spacing.xs },
    toggle: { ...typography.captionEyebrow, color: colors.textMuted },
    list: { maxHeight: sizes.photoCreditsMaxHeight },
    listContent: { gap: spacing.xs },
    row: { ...typography.secondarySmall, color: colors.textMuted },
    name: { color: colors.textPrimary },
    link: { color: colors.textSecondary, textDecorationLine: 'underline' },
  });
  const openUrl = (url: string) => () => {
    openBrowserAsync(url).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
      >
        <Text style={styles.toggle}>
          {open ? 'Hide' : 'Show'} photo credits · {rows.length}
        </Text>
      </Pressable>
      {open && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {rows.map((r) => (
            <Text key={r.playerId} style={styles.row}>
              <Text style={styles.name}>
                {r.memberNo} {r.playerName}
              </Text>
              {' — '}
              <Text
                style={styles.link}
                accessibilityRole="link"
                onPress={openUrl(r.credit.sourceUrl)}
              >
                {r.credit.author ?? 'Wikimedia Commons'}
              </Text>
              {' · '}
              <Text
                style={styles.link}
                accessibilityRole="link"
                onPress={openUrl(r.credit.licenceUrl ?? r.credit.sourceUrl)}
              >
                {r.credit.licence}
              </Text>
              {' · cropped'}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
