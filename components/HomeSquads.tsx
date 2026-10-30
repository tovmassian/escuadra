import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Flag } from './Flag';
import { ChevronGlyph } from './SettingsGlyphs';
import { TeamMarker } from './TeamMarker';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import type { SquadManifestEntry } from '@/types/squad';
import { borderWidths, opacity, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Home's row under the main button (#181): the starred teams as round buttons,
// newest first, each spoken by its name and opening its Difficulty; they scroll
// sideways when they don't fit, fading out at an edge that has more behind it.
// "All teams ›" to the picker sits on the right, always.
export function HomeSquads({
  squads,
  onOpen,
  onAllTeams,
}: {
  squads: readonly SquadManifestEntry[];
  onOpen: (squadId: string) => void;
  onAllTeams: () => void;
}) {
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  // How far the row is scrolled, and how wide it and its content are, so each
  // edge fades only while there is more to scroll to that way.
  const [scroll, setScroll] = useState({ x: 0, width: 0, content: 0 });
  const fadeStart = scroll.x > 0;
  const fadeEnd = scroll.x + scroll.width < scroll.content - 1;
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: sizes.minTapTarget,
    },
    squads: { flex: 1 },
    squadsContent: { gap: spacing.xxs + spacing.nudge },
    fade: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: sizes.home.squadsFade,
      pointerEvents: 'none',
    },
    fadeStart: { left: 0 },
    fadeEnd: { right: 0 },
    squad: {
      width: sizes.roundButton,
      height: sizes.roundButton,
      borderRadius: sizes.roundButton / 2,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    allTeams: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      minHeight: sizes.minTapTarget,
      // Holds "All teams" to the right when no team is starred (else the ScrollView's flex does).
      marginLeft: 'auto',
    },
    allTeamsLabel: { ...typography.rowTitle, color: colors.textSecondary },
  });

  return (
    <View style={styles.row}>
      {squads.length > 0 && (
        <View style={styles.squads}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.squadsContent}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setScroll((s) => ({ ...s, x }));
            }}
            onLayout={(e) => {
              const width = e.nativeEvent.layout.width;
              setScroll((s) => ({ ...s, width }));
            }}
            onContentSizeChange={(content) => setScroll((s) => ({ ...s, content }))}
          >
            {squads.map((squad) => {
              const name = squadDisplayName(squad, language);
              const flag = squad.kind === 'nation' ? flagFor(squad.name) : null;
              return (
                <Pressable
                  key={squad.id}
                  testID={`home-squad-${squad.id}`}
                  onPress={() => onOpen(squad.id)}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  style={({ pressed }) => [styles.squad, pressed && { opacity: opacity.settled }]}
                >
                  <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    {flag ? (
                      <Flag code={flag} size="squad" label={name} />
                    ) : (
                      <TeamMarker marker={squad.marker} variant="squad" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {fadeStart && (
            <LinearGradient
              colors={[colors.background, colors.backgroundClear]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fade, styles.fadeStart]}
            />
          )}
          {fadeEnd && (
            <LinearGradient
              colors={[colors.backgroundClear, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fade, styles.fadeEnd]}
            />
          )}
        </View>
      )}
      <Pressable
        testID="home-all-teams"
        onPress={onAllTeams}
        accessibilityRole="button"
        accessibilityLabel={t.home.allTeams}
        style={({ pressed }) => [styles.allTeams, pressed && { opacity: opacity.settled }]}
      >
        <Text style={styles.allTeamsLabel}>{t.home.allTeams}</Text>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <ChevronGlyph color={colors.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
}
