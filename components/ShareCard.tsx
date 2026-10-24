import { EscuadraMark } from '@/components/EscuadraMark';
import { ESCUADRA_WORDMARK } from '@/i18n/names';
import { useT } from '@/i18n/useT';
import type { ShareCardView, ShareItem } from '@/lib/shareResult';
import { bannerBands } from '@/lib/stageView';
import { MARK_VIEWBOX, markGeometry } from '@/theme/brand';
import { borderWidths, palettes, sizes, spacing, typography } from '@/theme/tokens';
import type { TeamMarker } from '@/types/squad';
import type { Ref } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';

interface ShareCardProps {
  view: ShareCardView;
  items: readonly ShareItem[];
  marker: TeamMarker;
  /** Drawn width in pt; the height follows the card's 9:16. */
  width: number;
  ref?: Ref<ViewInstance>;
}

interface Scalable {
  fontSize: number;
  lineHeight?: number;
  marginVertical?: number;
  letterSpacing?: number;
}

// A typography entry at the card's scale. The entries are written for the
// 360 pt layout, so the size, line height, vertical margin and tracking all follow `k`.
function scaled<T extends Scalable>(style: T, k: number) {
  return {
    ...style,
    fontSize: style.fontSize * k,
    ...(style.lineHeight !== undefined ? { lineHeight: style.lineHeight * k } : null),
    ...(style.marginVertical !== undefined ? { marginVertical: style.marginVertical * k } : null),
    ...(style.letterSpacing !== undefined ? { letterSpacing: style.letterSpacing * k } : null),
  };
}

// The picture a player sends (spec §4.2): the team's bands across the top, the
// score as the one big thing, a square per question, and the question the
// receiver will ask themselves. It is always drawn in the dark palette,
// whatever the app's theme is, so the picture is the same wherever it lands
// and does not depend on the sender's setting. It carries no photos and no
// player names (spec §1): a name gives the answer away to the people it is
// meant to challenge, and a photo would need its credit and a network load
// inside a capture. Every metric is `sizes.shareCard`'s 360 pt layout times
// `k`, so the same component draws the sheet's small preview and the 1080 px
// capture. Text never scales with the OS setting, because the bounds are fixed.
export function ShareCard({ view, items, marker, width, ref }: ShareCardProps) {
  const colors = palettes.dark;
  const t = useT();
  const card = sizes.shareCard;
  const k = width / card.width;
  const flawless = view.tier === 'excellent';
  const passed = view.tier !== 'fail';
  const bands = bannerBands(marker);

  // Sized so the strike's crossbar is `cornerArm` long, and placed so the
  // crossbar's top right meets the score row's top right, where the bars sit
  // on a fail. The same geometry as Results' `Score`.
  const { crossbar } = markGeometry;
  const strikeSize = (card.cornerArm * k * MARK_VIEWBOX) / crossbar.w;
  const unit = strikeSize / MARK_VIEWBOX;

  // The squares fill the content width exactly, `columns` to a row.
  const gap = spacing.xs * k;
  const squareSide = (width - 2 * card.pad * k - (card.columns - 1) * gap) / card.columns;
  // Laid out as rows rather than left to wrap: five squares and four gaps
  // equal the row's width, and a float that overshoots by a hair would push
  // the fifth onto a row of its own.
  const rows: ShareItem[][] = [];
  for (let i = 0; i < items.length; i += card.columns) {
    rows.push(items.slice(i, i + card.columns));
  }

  const styles = StyleSheet.create({
    root: {
      width,
      height: (width * card.height) / card.width,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    band: { height: card.band * k, flexDirection: 'row' },
    content: { flex: 1, padding: card.pad * k },
    brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs * k },
    word: { ...scaled(typography.shareWord, k), color: colors.textPrimary },
    spacer: { flex: 1 },
    eyebrow: { ...scaled(typography.shareEyebrow, k), color: colors.textMuted },
    score: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: spacing.xs * k,
      paddingRight: (card.cornerArm + spacing.lg) * k,
    },
    count: {
      ...scaled(typography.shareScore, k),
      color: flawless ? colors.success : colors.textPrimary,
    },
    tail: {
      ...scaled(typography.shareScoreTail, k),
      color: flawless ? colors.success : colors.textMuted,
    },
    crossbar: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: card.cornerArm * k,
      height: card.cornerBar * k,
      backgroundColor: colors.border,
    },
    post: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: card.cornerBar * k,
      height: card.cornerArm * k,
      backgroundColor: colors.border,
    },
    strike: {
      position: 'absolute',
      top: -crossbar.y * unit,
      right: -(MARK_VIEWBOX - crossbar.x - crossbar.w) * unit,
    },
    title: {
      ...scaled(typography.shareTitle, k),
      marginTop: card.titleGap * k,
      color: flawless ? colors.success : colors.textPrimary,
    },
    grid: { marginTop: card.gridGap * k, gap },
    gridRow: { flexDirection: 'row', gap },
    square: {
      width: squareSide,
      height: squareSide,
      borderRadius: card.squareRadius * k,
      borderWidth: borderWidths.emphasis * k,
      alignItems: 'center',
      justifyContent: 'center',
    },
    squareRight: { backgroundColor: colors.success, borderColor: colors.success },
    squareWrong: { backgroundColor: 'transparent', borderColor: colors.error },
    squareNumber: scaled(typography.shareSquare, k),
    squareNumberRight: { color: colors.background },
    squareNumberWrong: { color: colors.error },
    footer: { gap: spacing.xxs * k },
    question: { ...scaled(typography.shareQuestion, k), color: colors.textPrimary },
    link: { ...scaled(typography.shareLink, k), color: colors.textMuted },
  });

  return (
    <View
      ref={ref}
      // Android's capture needs a real native view, which a layout-only view
      // that React Native flattens away is not.
      collapsable={false}
      style={styles.root}
      accessible
      accessibilityLabel={t.share.pictureSpoken(view.eyebrow, view.correct, view.total, view.title)}
    >
      <View style={styles.band}>
        {bands.map((band, i) => (
          <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
        ))}
      </View>
      <View style={styles.content}>
        <View style={styles.brand}>
          <EscuadraMark size={card.mark * k} color={colors.accentLine} />
          <Text style={styles.word} allowFontScaling={false}>
            {ESCUADRA_WORDMARK}
          </Text>
        </View>
        <View style={styles.spacer} />
        <Text style={styles.eyebrow} allowFontScaling={false}>
          {view.eyebrow}
        </Text>
        <View style={styles.score}>
          <Text style={styles.count} allowFontScaling={false}>
            {view.correct}
          </Text>
          <Text style={styles.tail} allowFontScaling={false}>
            /{view.total}
          </Text>
          {passed ? (
            <View style={styles.strike} pointerEvents="none">
              <EscuadraMark
                size={strikeSize}
                color={flawless ? colors.success : colors.accentLine}
                ballColor={colors.success}
                showTrail={flawless}
              />
            </View>
          ) : (
            <>
              <View style={styles.crossbar} />
              <View style={styles.post} />
            </>
          )}
        </View>
        <Text style={styles.title} allowFontScaling={false}>
          {view.title}
        </Text>
        <View style={styles.grid}>
          {rows.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((item, i) => (
                <View
                  key={i}
                  style={[styles.square, item.correct ? styles.squareRight : styles.squareWrong]}
                >
                  <Text
                    style={[
                      styles.squareNumber,
                      item.correct ? styles.squareNumberRight : styles.squareNumberWrong,
                    ]}
                    allowFontScaling={false}
                  >
                    {item.no}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.spacer} />
        <View style={styles.footer}>
          <Text style={styles.question} allowFontScaling={false}>
            {view.question}
          </Text>
          <Text style={styles.link} allowFontScaling={false}>
            {view.link}
          </Text>
        </View>
      </View>
    </View>
  );
}
