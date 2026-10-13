import { typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { PhotoCredit } from '@/types/photo';
import { openBrowserAsync } from 'expo-web-browser';
import { StyleSheet, Text } from 'react-native';

// Photo POC credit, shown once a question is fully answered (option C in
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md). Author and
// licence only — never the file name or caption, which name the player.
export function PhotoCreditLine({ credit }: { credit: PhotoCredit }) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    line: { ...typography.secondarySmall, color: colors.textMuted },
    link: { color: colors.textSecondary, textDecorationLine: 'underline' },
  });
  const open = (url: string) => () => {
    void openBrowserAsync(url);
  };

  return (
    <Text style={styles.line}>
      Photo:{' '}
      <Text style={styles.link} accessibilityRole="link" onPress={open(credit.sourceUrl)}>
        {credit.author}
      </Text>
      {' · '}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={open(credit.licenceUrl ?? credit.sourceUrl)}
      >
        {credit.licence}
      </Text>
      {' · cropped'}
    </Text>
  );
}
