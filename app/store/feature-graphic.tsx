import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { EscuadraMark } from '@/components/EscuadraMark';
import { NumberWall } from '@/components/NumberWall';
import { ESCUADRA_WORDMARK } from '@/i18n/names';
import { useLanguage, useT } from '@/i18n/useT';
import { WALL_ROWS } from '@/lib/numberWall';
import { featureGraphic, palettes, spacing, typography } from '@/theme/tokens';

// Google Play's feature graphic (1024×500) — captured via `npm run
// gen:play-assets`, not part of in-app navigation. Nothing like it exists
// for iOS; see .claude/rules/design-handoff.md.
//
// Design B, "the lit number" (2026-10-31): Home's wall with every number
// unlit, one hero number lit with the mark in its corner, a shot into the top
// corner, and the lockup and tagline on the left. Deliberately not
// theme-reactive: a store listing image is one fixed asset, not a live screen,
// so it always draws in `palettes.dark`, whatever the capturing browser's
// colour scheme, and the wall stands still.
const colors = palettes.dark;
const WALL = WALL_ROWS.map((row) => ({ ...row, filled: {} }));
// "Who wears 7?", the question the listing opens with.
const HERO_NUMBER = 7;

export default function FeatureGraphic() {
  const t = useT();
  // Names the language it rendered in, so gen:play-assets' --lang can check the seed took.
  const language = useLanguage();
  return (
    <View style={styles.root} testID={`feature-graphic-${language}`}>
      <NumberWall top={featureGraphic.wallTop} rows={WALL} palette={colors} still />
      <LinearGradient
        colors={featureGraphic.fade.colors}
        locations={featureGraphic.fade.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.hero}>
        <Text style={styles.heroNumber}>{HERO_NUMBER}</Text>
        <View style={styles.heroMark}>
          <EscuadraMark size={featureGraphic.heroMark.size} color={colors.mark} showTrail />
        </View>
      </View>
      <View style={styles.column}>
        <View style={styles.lockup}>
          <EscuadraMark size={featureGraphic.lockupMark} color={colors.mark} />
          <Text style={styles.word}>{ESCUADRA_WORDMARK}</Text>
        </View>
        <Text style={styles.tagline}>{t.store.tagline}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  hero: { position: 'absolute', left: featureGraphic.hero.left, top: featureGraphic.hero.top },
  heroNumber: { ...typography.featureNumber, color: colors.textPrimary },
  heroMark: {
    position: 'absolute',
    left: featureGraphic.heroMark.left,
    top: featureGraphic.heroMark.top,
  },
  column: {
    position: 'absolute',
    left: featureGraphic.gutter,
    top: 0,
    bottom: 0,
    width: featureGraphic.column,
    justifyContent: 'center',
    gap: spacing.lg + spacing.nudge,
  },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  word: { ...typography.featureWordmark, color: colors.textPrimary },
  tagline: { ...typography.featureTagline, color: colors.textPrimary },
});
