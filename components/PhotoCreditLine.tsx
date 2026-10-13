import { typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { PhotoCredit } from '@/types/squad';
import { openBrowserAsync } from 'expo-web-browser';
import { StyleSheet, Text } from 'react-native';

// A photo's credit, shown once a question is fully answered (option C in
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md; where it
// finally sits is the redesign's call, §8.4). Author and licence only — never
// the file name or caption, which name the player.
export function PhotoCreditLine({ credit }: { credit: PhotoCredit }) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    line: { ...typography.secondarySmall, color: colors.textMuted },
    link: { color: colors.textSecondary, textDecorationLine: 'underline' },
  });
  // A link that fails to open has nothing to recover; the credit stays shown.
  const open = (url: string) => () => {
    openBrowserAsync(url).catch(() => {});
  };

  return (
    <Text style={styles.line}>
      Photo:{' '}
      <Text style={styles.link} accessibilityRole="link" onPress={open(credit.sourceUrl)}>
        {credit.author ?? 'Wikimedia Commons'}
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
