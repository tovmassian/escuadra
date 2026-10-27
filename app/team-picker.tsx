import { KindTabs, type Kind } from '@/components/KindTabs';
import { LetterRail } from '@/components/LetterRail';
import { PickerPill } from '@/components/PickerPill';
import { RoundBackButton } from '@/components/RoundBackButton';
import { SearchField } from '@/components/SearchField';
import { TeamRow } from '@/components/TeamRow';
import { TipsLayer } from '@/components/TipsLayer';
import { useTips } from '@/hooks/useTips';
import { useTitleFocus } from '@/hooks/useTitleFocus';
import { YourSquads } from '@/components/YourSquads';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import type { ConfederationFilter, LeagueFilter, SquadNames } from '@/lib/pickerView';
import {
  confederationFilters,
  confederationLabel,
  confederationSpoken,
  kindCounts,
  leagueFilters,
  leagueLabel,
  letterAt,
  nationSections,
  nationsCaption,
  teamProgress,
  visibleSquads,
} from '@/lib/pickerView';
import { listSquads } from '@/lib/squads';
import { openingTab, starredOfKind } from '@/lib/starred';
import { track } from '@/lib/telemetry';
import { NO_RESULTS_AFTER_MS } from '@/lib/telemetryEvents';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import { radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { SquadManifestEntry } from '@/types/squad';
import { router } from 'expo-router';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInstance,
  type ViewInstance,
} from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

// The team picker (#176; spec docs/superpowers/specs/2026-10-22-team-picker-design.md):
// one column that scrolls as a whole. Clubs are a plain list under a caption;
// nations are grouped A–Z, narrowed by confederation (#177), with a letter rail
// pinned over the right edge. Above either list, the tab's starred teams (#179).
export default function TeamPicker() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const hydrated = useProgressHydrated();
  const bestScores = useProgress((s) => s.bestScores);
  const starredSquads = useProgress((s) => s.starredSquads);
  const [filter, setFilter] = useState<Kind>(() => openingTab(starredSquads, listSquads()));
  const [league, setLeague] = useState<LeagueFilter>('ALL');
  const [confederation, setConfederation] = useState<ConfederationFilter>('ALL');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // How to play (#183): the tabs and pills, then the first row.
  const tips = useTips('picker');
  const switchRef = useRef<ViewInstance>(null);
  const firstRowRef = useRef<ViewInstance>(null);
  const titleRef = useRef<TextInstance>(null);
  useTitleFocus(titleRef, !tips.open);

  const squads = listSquads();
  const names = useMemo<SquadNames>(
    () => ({ nameOf: (s) => squadDisplayName(s, language), locale: language }),
    [language],
  );
  const leagues = useMemo(() => leagueFilters(squads), [squads]);
  const confederations = useMemo(() => confederationFilters(squads), [squads]);
  const counts = useMemo(() => kindCounts(squads, names, query), [squads, names, query]);
  const clubs = useMemo(
    () => (filter === 'club' ? visibleSquads(squads, 'club', league, names, query) : []),
    [squads, filter, league, names, query],
  );
  const sections = useMemo(
    () => (filter === 'nation' ? nationSections(squads, names, query, confederation) : []),
    [squads, filter, names, query, confederation],
  );
  // Your squads (#179): the tab's starred teams, whatever league or
  // confederation is picked, hidden while a search is typed.
  const starred = useMemo(
    () => (hydrated && query.trim() === '' ? starredOfKind(starredSquads, squads, filter) : []),
    [hydrated, query, starredSquads, squads, filter],
  );
  const letters = useMemo(() => sections.map((s) => s.letter), [sections]);
  const showRail = sections.length > 1;
  const shownLetter =
    current !== null && letters.includes(current) ? current : (letters[0] ?? null);
  const empty = filter === 'club' ? clubs.length === 0 : sections.length === 0;

  // Usage statistics (#221): a search that finds nothing, once per visit, and
  // only once it has stayed empty a moment, so letters typed on the way to a
  // team don't count. The words typed never leave the device.
  const searching = query.trim() !== '';
  const reportedEmpty = useRef(false);
  useEffect(() => {
    if (!searching || !empty || reportedEmpty.current) return;
    const timer = setTimeout(() => {
      reportedEmpty.current = true;
      track('picker.noResults', { kind: filter });
    }, NO_RESULTS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [searching, empty, filter, query]);

  // Each letter heading's y in the scrolled content, recorded on layout. The
  // record belongs to one list: a new tab, language, search or confederation
  // starts a new one, and the headings are keyed by it, so every heading
  // remounts and reports its y afresh.
  const layoutKey = `${filter}|${language}|${query}|${confederation}`;
  const offsets = useRef({ key: layoutKey, ys: new Map<string, number>() });
  const offsetsNow = () => {
    if (offsets.current.key !== layoutKey) {
      offsets.current = { key: layoutKey, ys: new Map() };
    }
    return offsets.current.ys;
  };
  // A rail jump scrolls a heading to the top, but near the end of the list
  // the scroll stops short of it, and the letter at the top is an earlier one.
  // The jumped-to letter stays current until the list scrolls away from where
  // the jump left it.
  const jumped = useRef<number | null>(null);

  // The rail is centred on the screen, but at the top of the page that would
  // set it over the search field and the tabs. It starts beside the first
  // letter heading instead and rides up with the list until it reaches the
  // centre, where it stays. It holds still while a finger is on it, so the
  // letters never slide out from under the touch, and catches up on release.
  //
  // The rail's offset is worked out on the UI thread, from the scroll there,
  // so it never trails the list by a frame. Positions are set, never timed.
  const [listTop, setListTop] = useState<number | null>(null);
  const [rootHeight, setRootHeight] = useState(0);
  // How far below the centre the rail starts: beside the first heading.
  const push = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const touching = useSharedValue(false);
  // Where the rail was when the finger landed.
  const frozen = useSharedValue(0);
  // `push` is written as soon as a layout reports a new value, before the
  // render that first shows the rail, and again as soon as a new letter count
  // changes the rail's height, before that render is painted. The rail is
  // never drawn at the centre while an effect catches up.
  const measured = useRef<{ listTop: number | null; rootHeight: number }>({
    listTop: null,
    rootHeight: 0,
  });
  const placeRail = () => {
    const { listTop: top, rootHeight: height } = measured.current;
    push.set(railPush(top, height, letters.length, insets.top, insets.bottom));
  };
  useLayoutEffect(() => {
    const { listTop: top, rootHeight: height } = measured.current;
    push.set(railPush(top, height, letters.length, insets.top, insets.bottom));
  }, [push, letters.length, insets.top, insets.bottom]);
  const railShift = useAnimatedStyle(() => ({
    transform: [
      { translateY: touching.value ? frozen.value : Math.max(0, push.value - scrollY.value) },
    ],
  }));
  // A touch lands and jumps in the same handler, so the rail's place is read
  // here, before the jump's scroll can reach the UI thread and move it.
  const onRailTouch = (active: boolean) => {
    if (active) frozen.set(Math.max(0, push.get() - scrollY.get()));
    touching.set(active);
  };

  const onJump = (letter: string) => {
    const y = Math.max(0, (offsetsNow().get(letter) ?? 0) - insets.top);
    jumped.current = y;
    scrollRef.current?.scrollTo({ y, animated: false });
    setCurrent(letter);
  };

  // The current letter is worked out on the JS side: the scroll handler hands
  // each offset across.
  const followScroll = (y: number, content: number, view: number) => {
    if (jumped.current !== null) {
      const end = Math.max(0, content - view);
      if (Math.abs(y - Math.min(jumped.current, end)) < 1) return;
      jumped.current = null;
    }
    // `onLayout` order isn't guaranteed, so the offsets are sorted by y.
    const sorted = Array.from(offsetsNow(), ([letter, top]) => ({ letter, y: top })).sort(
      (a, b) => a.y - b.y,
    );
    // The top of the scroll is below the status bar, which the list scrolls under.
    setCurrent(letterAt(sorted, y + insets.top + spacing.xs));
  };
  const followsLetters = filter === 'nation';
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
      if (followsLetters) {
        scheduleOnRN(
          followScroll,
          e.contentOffset.y,
          e.contentSize.height,
          e.layoutMeasurement.height,
        );
      }
    },
  });

  // Switching tabs drops the league and the confederation back to ALL, so a
  // tab always opens unfiltered rather than silently re-applying a league
  // picked before a detour through the other tab, while its pill row was
  // swapped out. The search query deliberately survives the switch instead —
  // a name typed on one tab may be worth checking on the other. Tapping the
  // tab already selected is not a switch, and keeps its filter (#190).
  const changeKind = (kind: Kind) => {
    if (kind === filter) return;
    setFilter(kind);
    setLeague('ALL');
    setConfederation('ALL');
    setCurrent(null);
    jumped.current = null;
  };
  const changeConfederation = (next: ConfederationFilter) => {
    setConfederation(next);
    setCurrent(null);
    jumped.current = null;
  };
  const changeQuery = (text: string) => {
    setQuery(text);
    setCurrent(null);
    jumped.current = null;
  };

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.lg },
    header: { gap: spacing.md + 2, marginBottom: spacing.md + 2 },
    // The tabs and pills, together for the first tip, at the header's own gap.
    switch: { gap: spacing.md + 2 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    count: { ...typography.monoCaption, color: colors.textMuted },
    title: { ...typography.displayTitle, color: colors.textPrimary },
    // `flexGrow: 0` keeps the horizontal scroller from claiming leftover
    // vertical space in this column; `flexShrink: 0` stops the content below
    // from taking it back. Without the latter the track collapses on native
    // once the column is long enough to scroll (RN shrinks flex children by
    // default where RN-Web does not, so this never reproduces in the web
    // build). The negative margin runs the pills out to the screen's edge.
    pillTrack: { flexGrow: 0, flexShrink: 0, marginRight: -spacing.lg },
    // `alignItems: 'center'` keeps each pill at its own intrinsic height. A row
    // stretches its children by default, so a squeezed track would otherwise
    // flatten the pills and clip their labels rather than overflow.
    pillRow: { alignItems: 'center', gap: spacing.xs, paddingRight: spacing.lg },
    // The canvas sets the list a little further below the controls than their
    // own gap.
    listStart: { marginTop: spacing.xs },
    caption: { ...typography.monoCaption, color: colors.textMuted, paddingBottom: spacing.xxs },
    heading: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      paddingBottom: spacing.xxs,
    },
    // The caption shrinks before it pushes the row wider than the screen.
    nationsCaption: { ...typography.monoCaption, color: colors.textMuted, flexShrink: 1 },
    // Every heading but the first opens with space above its letter.
    headingAfter: { paddingTop: spacing.md + 2 },
    letter: { ...typography.letterHeading },
    // Keeps the rail clear of a row's score.
    gutter: { paddingRight: Math.max(0, sizes.rail.width - spacing.lg) },
    empty: { paddingTop: spacing.xxl, alignItems: 'center' },
    emptyTitle: { ...typography.secondary, color: colors.textSecondary, marginBottom: spacing.xxs },
    emptySubtitle: { ...typography.secondarySmall, color: colors.textMuted },
    // Spans the screen's height, so the rail inside is centred on it; only
    // the rail itself takes touches.
    railFrame: {
      position: 'absolute',
      top: insets.top,
      bottom: insets.bottom,
      right: 0,
      justifyContent: 'center',
      pointerEvents: 'box-none',
    },
  });

  // `first`: the row the second tip rings.
  const row = (item: SquadManifestEntry, card?: { last: boolean }, first = false) => (
    <TeamRow
      key={item.id}
      ref={first ? firstRowRef : undefined}
      variant={card ? 'card' : 'list'}
      last={card?.last}
      name={squadDisplayName(item, language)}
      marker={item.marker}
      flag={item.kind === 'nation' ? flagFor(item.name) : undefined}
      progress={hydrated ? teamProgress(item.id, bestScores, item.lastUpdated) : undefined}
      onPress={() =>
        router.push({
          pathname: '/team/[squadId]/difficulty',
          params: { squadId: item.id, from: 'picker', search: String(searching) },
        })
      }
    />
  );

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        measured.current.rootHeight = height;
        placeRail();
        setRootHeight(height);
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        testID="picker-list"
        {...tips.contentA11y}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.topBar}>
            <RoundBackButton
              testID="picker-back"
              label={t.common.back}
              onPress={() => router.dismissTo('/')}
            />
            <Text style={styles.count}>{t.picker.squadCount(squads.length)}</Text>
          </View>
          <Text ref={titleRef} style={styles.title} accessibilityRole="header">
            {t.picker.title}
          </Text>
          <SearchField value={query} onChange={changeQuery} onClear={() => changeQuery('')} />
          <View ref={switchRef} collapsable={false} style={styles.switch}>
            <KindTabs value={filter} counts={counts} onChange={changeKind} />
            <ScrollView
              key={filter}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.pillTrack}
              contentContainerStyle={styles.pillRow}
            >
              {filter === 'club'
                ? leagues.map((l) => (
                    <PickerPill
                      key={l}
                      testID={`league-${l}`}
                      label={leagueLabel(l, t)}
                      active={league === l}
                      onPress={() => setLeague(l)}
                    />
                  ))
                : confederations.map((c) => (
                    <PickerPill
                      key={c}
                      testID={`confederation-${c}`}
                      label={confederationLabel(c, t)}
                      spokenLabel={confederationSpoken(c, t)}
                      active={confederation === c}
                      onPress={() => changeConfederation(c)}
                    />
                  ))}
            </ScrollView>
          </View>
        </View>

        {starred.length > 0 && (
          <YourSquads>
            {starred.map((item, i) => row(item, { last: i === starred.length - 1 }, i === 0))}
          </YourSquads>
        )}

        {filter === 'club' && clubs.length > 0 && (
          <View style={styles.listStart}>
            <Text style={styles.caption}>
              {t.picker.listCaption(
                league === 'ALL' ? t.picker.allClubs : leagueLabel(league, t),
                clubs.length,
              )}
            </Text>
            {clubs.map((item, i) => row(item, undefined, starred.length === 0 && i === 0))}
          </View>
        )}

        {sections.map((section, i) => (
          <Fragment key={section.letter}>
            {/* Must stay a direct child of the ScrollView's content: onLayout's
                y is then the heading's scroll offset, which the rail jumps to. */}
            <View
              key={`${layoutKey}:${section.letter}`}
              style={[
                styles.heading,
                i === 0 ? styles.listStart : styles.headingAfter,
                // The rail starts beside the first heading, so its caption stays clear of it.
                i === 0 && showRail && styles.gutter,
              ]}
              onLayout={(e) => {
                const { y } = e.nativeEvent.layout;
                offsetsNow().set(section.letter, y);
                if (i === 0) {
                  measured.current.listTop = y;
                  placeRail();
                  setListTop(y);
                }
              }}
            >
              <Text
                style={[
                  styles.letter,
                  {
                    color: section.letter === shownLetter ? colors.accentLine : colors.textPrimary,
                  },
                ]}
                accessibilityRole="header"
              >
                {section.letter}
              </Text>
              {i === 0 && (
                <Text style={styles.nationsCaption} numberOfLines={1}>
                  {nationsCaption(confederation, t)}
                </Text>
              )}
            </View>
            <View style={showRail && styles.gutter}>{section.squads.map((item) => row(item))}</View>
          </Fragment>
        ))}

        {empty && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t.picker.noTeams}</Text>
            {query.trim().length > 0 && (
              <Text style={styles.emptySubtitle}>{t.picker.noResults(query.trim())}</Text>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {showRail && listTop !== null && rootHeight > 0 && (
        <Animated.View style={[styles.railFrame, railShift]} {...tips.contentA11y}>
          <LetterRail
            letters={letters}
            current={shownLetter}
            onJump={onJump}
            onTouch={onRailTouch}
          />
        </Animated.View>
      )}

      {tips.open && (
        <TipsLayer
          tips={[
            { target: switchRef, radius: radii.xl, ...t.tips.picker.switch },
            { target: firstRowRef, radius: radii.lg, ...t.tips.picker.pick },
          ]}
          onClose={tips.close}
          onSkip={tips.skip}
          onShown={tips.onShown}
          scrollBy={(dy) =>
            scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.get() + dy), animated: false })
          }
        />
      )}
    </View>
  );
}

// How far below the screen's centre the rail starts, so that it sits beside
// the first letter heading (`listTop`, in the scrolled content) rather than
// over the search field and the tabs; 0 once that heading is below the centre.
function railPush(
  listTop: number | null,
  rootHeight: number,
  letterCount: number,
  insetTop: number,
  insetBottom: number,
): number {
  if (listTop === null) return 0;
  const railHeight = letterCount * sizes.rail.letter;
  const railTop = insetTop + (rootHeight - insetTop - insetBottom - railHeight) / 2;
  return Math.max(0, listTop - railTop);
}
