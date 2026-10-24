import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackGlyph, GridGlyph, ListGlyph } from '@/components/ActionGlyphs';
import { FilterPill } from '@/components/FilterPill';
import { PhotoCredits } from '@/components/PhotoCredits';
import { PlayerCard } from '@/components/PlayerCard';
import { StudyListRow } from '@/components/StudyListRow';
import { TipsLayer } from '@/components/TipsLayer';
import { useTips } from '@/components/useTips';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import { feedback } from '@/lib/haptics';
import { photoFor } from '@/lib/photos';
import { positionCode } from '@/lib/roundView';
import { getRoster, getSquad } from '@/lib/squads';
import { bannerBands } from '@/lib/stageView';
import {
  filterCounts,
  STUDY_FILTERS,
  studyAffiliation,
  studyCount,
  studyCreditRows,
  studyLabel,
  studyRows,
  type StudyFilter,
} from '@/lib/studyView';
import { track } from '@/lib/telemetry';
import { useProgress } from '@/stores/progress';
import {
  borderWidths,
  durations,
  fontScaleCap,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { RosterEntry } from '@/types/squad';

// The cards sit in two columns, 10 pt apart. Colour-free, so it lives at
// module scope; a stable component keeps FlatList from remounting the gaps.
const gridStyles = StyleSheet.create({ rowGap: { height: sizes.studyGridGap } });
function GridRowGap() {
  return <View style={gridStyles.rowGap} />;
}

// Windowing (spec §9). FlatList counts rows, and a grid row holds two cards, so
// these open with about a screenful: four grid rows (eight cards) or ten list
// rows. A window of 2 screens keeps half a screen of cards mounted beyond
// the visible ones, so a squad's photos load as you scroll, not all at once.
// (6 rows and a window of 5, tried first, mounted 20 cards on open.)
const INITIAL_ROWS = { grid: 4, list: 10 } as const;

// Each control is drawn 36 pt and takes hitSlop up to Apple's 44 pt target.
const CONTROL_SLOP = (sizes.minTapTarget - sizes.studyControl) / 2;

// The Study screen (spec §5.1): a top bar (back, Hide names, cards or list), the
// team's banner over "Squad" with a count, the position filters, and the squad
// as player cards or a list, sorted by shirt number, with the photo credits at
// the end. Hide names turns each name into a "Tap to reveal" pill, so the
// squad can be self-tested from the number alone.
//
// The list is virtualised, so photos load as cards mount, never a whole squad
// at once (spec §9).
export default function Study() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const { squadId } = useLocalSearchParams<{ squadId: string }>();
  const view = useProgress((s) => s.studyView);
  const setStudyView = useProgress((s) => s.setStudyView);
  const [filter, setFilter] = useState<StudyFilter>('ALL');
  // Hide names is not persisted: a fresh visit starts with the names showing.
  const [hidden, setHidden] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const listRef = useRef<FlatList<RosterEntry>>(null);
  // How to play (#183): Hide names, then the position filters.
  const tips = useTips('study');
  const hideRef = useRef<ViewInstance>(null);
  const filtersRef = useRef<ViewInstance>(null);

  const squad = getSquad(squadId);
  const roster = useMemo(() => getRoster(squadId), [squadId]);
  const rows = useMemo(() => studyRows(roster, filter), [roster, filter]);
  const counts = useMemo(() => filterCounts(roster), [roster]);
  const creditRows = useMemo(() => studyCreditRows(rows), [rows]);
  const kind = squad?.kind;
  useEffect(() => {
    if (kind) track('study.opened', { kind });
  }, [squadId, kind]);

  // Every card and row gets this same press, whether or not names are hidden,
  // so none of them changes what it is when a name is revealed (that would
  // remount the card and reload its photo). It does nothing unless the name is
  // hidden. A card's label changes silently, so the name is also announced
  // for a screen-reader user who is self-testing.
  const reveal = useCallback(
    (id: string, name: string) => {
      if (!hidden || revealed.has(id)) return;
      setRevealed((prev) => new Set(prev).add(id));
      feedback('reveal');
      AccessibilityInfo.announceForAccessibility(name);
    },
    [hidden, revealed],
  );

  if (!squad) return null;

  const grid = view === 'grid';
  const bands = bannerBands(squad.marker);

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingTop: insets.top },
    topBar: {
      height: sizes.topBar.height,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingLeft: spacing.xxs,
      paddingRight: spacing.sm,
    },
    back: {
      width: sizes.minTapTarget,
      height: sizes.minTapTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spacer: { flex: 1 },
    hide: {
      height: sizes.studyControl,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderColor: hidden ? colors.textPrimary : colors.border,
      backgroundColor: hidden ? colors.textPrimary : 'transparent',
    },
    hideLabel: {
      ...typography.slotValue,
      color: hidden ? colors.background : colors.textPrimary,
    },
    viewToggle: {
      width: sizes.studyControl,
      height: sizes.studyControl,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderColor: colors.border,
    },
    header: { paddingHorizontal: spacing.md, paddingTop: spacing.xxs, gap: spacing.xs - 2 },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    banner: {
      width: sizes.studyBanner.width,
      height: sizes.studyBanner.height,
      flexDirection: 'row',
      borderRadius: sizes.teamMarkerRadius,
      overflow: 'hidden',
    },
    eyebrow: { ...typography.captionEyebrow, flexShrink: 1, color: colors.textMuted },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs + 2 },
    title: { ...typography.titleDisplay, color: colors.textPrimary },
    count: { ...typography.statMonoSmall, color: colors.textMuted },
    // A horizontal ScrollView grows to fill a column by default; this one
    // takes only its pills' height.
    filtersScroll: { flexGrow: 0, flexShrink: 0 },
    filters: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    // The pills, in one view for the second tip to ring.
    filterRow: { flexDirection: 'row', gap: spacing.xs - 2 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.md },
    columns: { gap: sizes.studyGridGap },
    cell: { flex: 1 },
    footer: { paddingTop: spacing.lg },
  });

  const renderItem = ({ item, index }: { item: RosterEntry; index: number }) => {
    const { member, player } = item;
    const covered = hidden && !revealed.has(player.id);
    const affiliation = studyAffiliation(player, squad.kind, language);
    const flag = squad.kind === 'club' ? flagFor(player.nationality) : null;
    const label = studyLabel(member.no, player, affiliation, covered, t);
    const photo = photoFor(player);
    const onPress = () => reveal(player.id, player.name);

    if (!grid) {
      return (
        <StudyListRow
          shirtNumber={member.no}
          name={player.name}
          nameHidden={covered}
          affiliation={affiliation}
          affiliationFlag={flag}
          position={positionCode(player.position, t)}
          photo={photo}
          marker={squad.marker}
          accessibilityLabel={label}
          onPress={onPress}
        />
      );
    }
    // An odd squad leaves its last row one card short; an empty cell beside
    // it keeps that card the width of the others.
    const lone = index === rows.length - 1 && rows.length % 2 === 1;
    return (
      <>
        <Animated.View style={styles.cell} entering={FadeIn.duration(durations.transition)}>
          <PlayerCard
            height={sizes.playerCard.studyHeight}
            shirtNumber={member.no}
            name={player.name}
            badge={positionCode(player.position, t)}
            nameHidden={covered}
            lineTone="neutral"
            line={affiliation}
            lineFlag={flag}
            photo={photo}
            marker={squad.marker}
            accessibilityLabel={label}
            onPress={onPress}
          />
        </Animated.View>
        {lone ? <View style={styles.cell} /> : null}
      </>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar} {...tips.contentA11y}>
        <Pressable
          testID="study-back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          style={styles.back}
        >
          <BackGlyph color={colors.textSecondary} />
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          ref={hideRef}
          testID="study-hide-names"
          onPress={() => {
            setHidden(!hidden);
            setRevealed(new Set());
          }}
          accessibilityRole="switch"
          // A constant name, so the switch reads "Hide names, on" and never
          // "Show names, on"; the visible text may flip. aria-checked is for
          // react-native-web, which does not read accessibilityState.
          accessibilityLabel={t.study.hideNames}
          accessibilityState={{ checked: hidden }}
          aria-checked={hidden}
          hitSlop={CONTROL_SLOP}
          style={styles.hide}
        >
          <Text style={styles.hideLabel} maxFontSizeMultiplier={fontScaleCap.display}>
            {hidden ? t.study.showNames : t.study.hideNames}
          </Text>
        </Pressable>
        <Pressable
          testID="study-view-toggle"
          onPress={() => setStudyView(grid ? 'list' : 'grid')}
          accessibilityRole="button"
          accessibilityLabel={grid ? t.study.showAsList : t.study.showAsCards}
          hitSlop={CONTROL_SLOP}
          style={styles.viewToggle}
        >
          {grid ? (
            <ListGlyph color={colors.textPrimary} />
          ) : (
            <GridGlyph color={colors.textPrimary} />
          )}
        </Pressable>
      </View>

      <View style={styles.header} {...tips.contentA11y}>
        <View style={styles.eyebrowRow}>
          <View style={styles.banner}>
            {bands.map((band, i) => (
              <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
            ))}
          </View>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {[squadDisplayName(squad, language), squad.season].join(' · ')}
          </Text>
        </View>
        <View style={styles.titleRow}>
          <Text
            style={styles.title}
            maxFontSizeMultiplier={fontScaleCap.display}
            accessibilityRole="header"
          >
            {t.study.title}
          </Text>
          <Text style={styles.count}>{studyCount(rows.length, roster.length, filter, t)}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
        {...tips.contentA11y}
      >
        <View ref={filtersRef} collapsable={false} style={styles.filterRow}>
          {STUDY_FILTERS.map((f) => (
            <FilterPill
              key={f}
              label={f === 'ALL' ? t.study.all : positionCode(f, t)}
              count={counts[f]}
              active={filter === f}
              onPress={() => {
                if (f === filter) return;
                setFilter(f);
                // A shorter list would otherwise clamp to its bottom. Not a re-key
                // by filter: that would replay every card's fade.
                listRef.current?.scrollToOffset({ offset: 0, animated: false });
              }}
            />
          ))}
        </View>
      </ScrollView>

      <FlatList
        ref={listRef}
        {...tips.contentA11y}
        // A FlatList cannot change its column count in place.
        key={view}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(r) => r.player.id}
        renderItem={renderItem}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? styles.columns : undefined}
        ItemSeparatorComponent={grid ? GridRowGap : undefined}
        ListFooterComponent={
          <View style={styles.footer}>
            <PhotoCredits rows={creditRows} numbersOnly />
          </View>
        }
        initialNumToRender={grid ? INITIAL_ROWS.grid : INITIAL_ROWS.list}
        windowSize={2}
        maxToRenderPerBatch={6}
      />

      {tips.open && (
        <TipsLayer
          tips={[
            { target: hideRef, radius: radii.pill, ...t.tips.study.hide },
            { target: filtersRef, radius: radii.pill, ...t.tips.study.positions },
          ]}
          onClose={tips.close}
          onSkip={tips.skip}
          onShown={tips.onShown}
        />
      )}
    </View>
  );
}
