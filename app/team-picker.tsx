import { KindTabs, type Kind } from '@/components/KindTabs';
import { LetterRail } from '@/components/LetterRail';
import { PickerPill } from '@/components/PickerPill';
import { RoundBackButton } from '@/components/RoundBackButton';
import { SearchField } from '@/components/SearchField';
import { TeamRow } from '@/components/TeamRow';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import type { LeagueFilter, SquadNames } from '@/lib/pickerView';
import {
  kindCounts,
  leagueFilters,
  leagueLabel,
  letterAt,
  nationSections,
  teamProgress,
  visibleSquads,
} from '@/lib/pickerView';
import { listSquads } from '@/lib/squads';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import { sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { SquadManifestEntry } from '@/types/squad';
import { router } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The team picker (#176; spec docs/superpowers/specs/2026-10-22-team-picker-design.md):
// one column that scrolls as a whole. Clubs are a plain list under a caption;
// nations are grouped A–Z, with a letter rail pinned over the right edge.
export default function TeamPicker() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const hydrated = useProgressHydrated();
  const bestScores = useProgress((s) => s.bestScores);
  const [filter, setFilter] = useState<Kind>('club');
  const [league, setLeague] = useState<LeagueFilter>('ALL');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const squads = listSquads();
  const names = useMemo<SquadNames>(
    () => ({ nameOf: (s) => squadDisplayName(s, language), locale: language }),
    [language],
  );
  const leagues = useMemo(() => leagueFilters(squads), [squads]);
  const counts = useMemo(() => kindCounts(squads, names, query), [squads, names, query]);
  const clubs = useMemo(
    () => (filter === 'club' ? visibleSquads(squads, 'club', league, names, query) : []),
    [squads, filter, league, names, query],
  );
  const sections = useMemo(
    () => (filter === 'nation' ? nationSections(squads, names, query) : []),
    [squads, filter, names, query],
  );
  const letters = useMemo(() => sections.map((s) => s.letter), [sections]);
  const showRail = sections.length > 1;
  const shownLetter =
    current !== null && letters.includes(current) ? current : (letters[0] ?? null);
  const empty = filter === 'club' ? clubs.length === 0 : sections.length === 0;

  // Each letter heading's y in the scrolled content, recorded on layout. The
  // record belongs to one list: a new tab, language or search starts a new
  // one, and the headings are keyed by it, so every heading remounts and
  // reports its y afresh.
  const layoutKey = `${filter}|${language}|${query}`;
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
  const [listTop, setListTop] = useState<number | null>(null);
  const [rootHeight, setRootHeight] = useState(0);
  const shift = useSharedValue(0);
  const scrollY = useRef(0);
  const touching = useRef(false);
  const railHeight = letters.length * sizes.rail.letter;
  const railTop = insets.top + (rootHeight - insets.top - insets.bottom - railHeight) / 2;
  const push = listTop === null ? 0 : Math.max(0, listTop - railTop);
  const placeRail = () => {
    if (!touching.current) shift.value = Math.max(0, push - scrollY.current);
  };
  useEffect(() => {
    if (!touching.current) shift.value = Math.max(0, push - scrollY.current);
  }, [push, shift]);
  const railShift = useAnimatedStyle(() => ({ transform: [{ translateY: shift.value }] }));
  const onRailTouch = (active: boolean) => {
    touching.current = active;
    placeRail();
  };

  const onJump = (letter: string) => {
    const y = Math.max(0, (offsetsNow().get(letter) ?? 0) - insets.top);
    jumped.current = y;
    scrollRef.current?.scrollTo({ y, animated: false });
    setCurrent(letter);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    scrollY.current = y;
    placeRail();
    if (filter !== 'nation') return;
    if (jumped.current !== null) {
      const end = Math.max(0, contentSize.height - layoutMeasurement.height);
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

  // Switching tabs drops the league back to ALL, so tapping "Clubs" always
  // shows every club rather than silently re-applying a league picked before
  // a detour through the nations tab, while its pill row was hidden. The
  // search query deliberately survives the switch instead — a name typed on
  // one tab may be worth checking on the other.
  const changeKind = (kind: Kind) => {
    setFilter(kind);
    setLeague('ALL');
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
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    count: { ...typography.monoCaption, color: colors.textMuted },
    title: { ...typography.displayTitle, color: colors.textPrimary },
    // `flexGrow: 0` keeps the horizontal scroller from claiming leftover
    // vertical space in this column; `flexShrink: 0` stops the content below
    // from taking it back. Without the latter the track collapses on native
    // once the column is long enough to scroll (RN shrinks flex children by
    // default where RN-Web does not, so this never reproduces in the web
    // build). The negative margin runs the pills out to the screen's edge.
    leagueTrack: { flexGrow: 0, flexShrink: 0, marginRight: -spacing.lg },
    // `alignItems: 'center'` keeps each pill at its own intrinsic height. A row
    // stretches its children by default, so a squeezed track would otherwise
    // flatten the pills and clip their labels rather than overflow.
    leagueRow: { alignItems: 'center', gap: spacing.xs, paddingRight: spacing.lg },
    // The canvas sets the list a little further below the controls than their
    // own gap.
    listStart: { marginTop: spacing.xs },
    caption: { ...typography.monoCaption, color: colors.textMuted, paddingBottom: spacing.xxs },
    heading: { paddingBottom: spacing.xxs },
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

  const row = (item: SquadManifestEntry) => (
    <TeamRow
      key={item.id}
      name={squadDisplayName(item, language)}
      marker={item.marker}
      flag={item.kind === 'nation' ? flagFor(item.name) : undefined}
      progress={hydrated ? teamProgress(item.id, bestScores) : undefined}
      onPress={() =>
        router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId: item.id } })
      }
    />
  );

  return (
    <View style={styles.root} onLayout={(e) => setRootHeight(e.nativeEvent.layout.height)}>
      <ScrollView
        ref={scrollRef}
        testID="picker-list"
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
          <Text style={styles.title} accessibilityRole="header">
            {t.picker.title}
          </Text>
          <SearchField value={query} onChange={changeQuery} onClear={() => changeQuery('')} />
          <KindTabs value={filter} counts={counts} onChange={changeKind} />
          {filter === 'club' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.leagueTrack}
              contentContainerStyle={styles.leagueRow}
            >
              {leagues.map((l) => (
                <PickerPill
                  key={l}
                  label={leagueLabel(l, t)}
                  active={league === l}
                  onPress={() => setLeague(l)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Your squads (#179) fills this slot. */}
        <View testID="your-squads-slot" />

        {filter === 'club' && clubs.length > 0 && (
          <View style={styles.listStart}>
            <Text style={styles.caption}>
              {t.picker.listCaption(
                league === 'ALL' ? t.picker.allClubs : leagueLabel(league, t),
                clubs.length,
              )}
            </Text>
            {clubs.map(row)}
          </View>
        )}

        {sections.map((section, i) => (
          <Fragment key={section.letter}>
            {/* Must stay a direct child of the ScrollView's content: onLayout's
                y is then the heading's scroll offset, which the rail jumps to. */}
            <View
              key={`${layoutKey}:${section.letter}`}
              style={[styles.heading, i === 0 ? styles.listStart : styles.headingAfter]}
              onLayout={(e) => {
                const { y } = e.nativeEvent.layout;
                offsetsNow().set(section.letter, y);
                if (i === 0) setListTop(y);
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
            </View>
            <View style={showRail && styles.gutter}>{section.squads.map(row)}</View>
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
      </ScrollView>

      {showRail && listTop !== null && rootHeight > 0 && (
        <Animated.View style={[styles.railFrame, railShift]}>
          <LetterRail
            letters={letters}
            current={shownLetter}
            onJump={onJump}
            onTouch={onRailTouch}
          />
        </Animated.View>
      )}
    </View>
  );
}
