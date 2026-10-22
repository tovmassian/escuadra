import { StyleSheet, Text, View } from 'react-native';
import { BrandGradient } from '@/components/BrandGradient';
import { EscuadraMark } from '@/components/EscuadraMark';
import { ESCUADRA_WORDMARK } from '@/i18n/names';
import { useT } from '@/i18n/useT';
import { palettes, sizes, spacing, typography } from '@/theme/tokens';

// Google Play's feature graphic (1024×500) — captured via `npm run
// gen:play-assets`, not part of in-app navigation. Nothing like it exists
// for iOS; see .claude/rules/design-handoff.md.
//
// Deliberately not theme-reactive: a store listing image is one fixed asset,
// not a live screen, so this always renders the dark-ground mark/text
// combination against `gradients.plate` — the same fixed (non-themed)
// gradient the icon plate uses — rather than following the capturing
// device's colour scheme.
export default function FeatureGraphic() {
  const t = useT();
  return (
    <BrandGradient gradient="plate" style={styles.root}>
      <View style={styles.content}>
        <EscuadraMark size={sizes.wordmarkMarkHero} color={palettes.dark.mark} showTrail />
        <Text style={styles.word}>{ESCUADRA_WORDMARK}</Text>
        <Text style={styles.tagline}>{t.store.tagline}</Text>
      </View>
    </BrandGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: spacing.sm },
  word: { ...typography.wordmarkHero, color: palettes.dark.textPrimary },
  tagline: { ...typography.body, color: palettes.dark.textSecondary },
});
