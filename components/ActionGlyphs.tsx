import { StyleSheet, View } from 'react-native';
import { borderWidths, iconSize } from '@/theme/tokens';

// Glyphs for Results' and Study's icon buttons, drawn from Views as SearchField
// does. No icon library: one font load and one dependency for a handful of
// marks isn't worth it.

/** Close: two crossed bars. */
export function CloseGlyph({ color }: { color: string }) {
  const s = iconSize.closeGlyph;
  const bar = {
    position: 'absolute' as const,
    top: s / 2 - borderWidths.thick,
    left: 0,
    width: s,
    height: borderWidths.thick * 2,
    borderRadius: borderWidths.thick,
    backgroundColor: color,
  };
  return (
    <View style={{ width: s, height: s }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/** Share: an open tray with an arrow rising out of it. */
export function ShareGlyph({ color }: { color: string }) {
  const s = iconSize.shareGlyph;
  const w = borderWidths.thick + borderWidths.hairline / 2; // ~2 pt strokes
  const styles = StyleSheet.create({
    box: { width: s, height: s },
    tray: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: s * 0.45,
      borderWidth: w,
      borderTopWidth: 0,
      borderColor: color,
      borderBottomLeftRadius: w * 2,
      borderBottomRightRadius: w * 2,
    },
    // Starts a stroke below the top, inside the head's apex, so its square
    // end never pokes out past the point.
    shaft: {
      position: 'absolute',
      left: s / 2 - w / 2,
      top: w,
      width: w,
      height: s * 0.68,
      backgroundColor: color,
    },
    head: {
      position: 'absolute',
      left: s / 2 - s * 0.2,
      top: w / 2,
      width: s * 0.4,
      height: s * 0.4,
      borderLeftWidth: w,
      borderTopWidth: w,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
    },
  });
  return (
    <View style={styles.box}>
      <View style={styles.tray} />
      <View style={styles.shaft} />
      <View style={styles.head} />
    </View>
  );
}

/** Retry: a ring turning anticlockwise, open on the left, with an arrowhead
 *  on its upper end pointing into the gap. */
export function RetryGlyph({ color }: { color: string }) {
  const s = iconSize.retryGlyph;
  const w = borderWidths.thick + borderWidths.hairline / 2;
  // The ring's centre line ends at 10:30, where the transparent side's edge
  // falls once the ring is turned a quarter: `end` is that point's x and y.
  const end = s / 2 - (s / 2 - w / 2) * Math.SQRT1_2;
  const head = s * 0.3;
  const styles = StyleSheet.create({
    box: { width: s, height: s },
    ring: {
      ...StyleSheet.absoluteFill,
      borderRadius: s / 2,
      borderWidth: w,
      borderColor: color,
      borderTopColor: 'transparent',
      transform: [{ rotate: '-90deg' }],
    },
    // Two strokes meeting at the ring's end, the corner pointing down-left
    // along the turn and the arms running back up and right.
    head: {
      position: 'absolute',
      left: end - w / 2,
      top: end + w / 2 - head,
      width: head,
      height: head,
      borderLeftWidth: w,
      borderBottomWidth: w,
      borderColor: color,
    },
  });
  return (
    <View style={styles.box}>
      <View style={styles.ring} />
      <View style={styles.head} />
    </View>
  );
}

// Study's back, list and grid marks come from the design board's 24-unit icon
// grid, at its 2.2 stroke: every measure below is in those units, scaled by
// `size / GRID` to the glyph's token size.
const GRID = 24;
const STROKE = 2.2;

/** Back: a chevron pointing left (‹). */
export function BackGlyph({ color }: { color: string }) {
  const s = iconSize.back;
  const k = s / GRID;
  const w = STROKE * k;
  // Two arms of 7 units across and 14 down: a corner of a square, turned 45
  // degrees so it points left. Its side is an arm's centre line plus half a
  // stroke, since the border sits inside the square.
  const side = 7 * Math.SQRT2 * k + w / 2;
  const styles = StyleSheet.create({
    box: { width: s, height: s },
    // The chevron reaches `side / sqrt(2)` left of the turned square's centre
    // and nothing to its right, so the centre sits half that right of the
    // glyph's own to centre the chevron.
    chevron: {
      position: 'absolute',
      left: s / 2 + side / (2 * Math.SQRT2) - side / 2,
      top: s / 2 - side / 2,
      width: side,
      height: side,
      borderLeftWidth: w,
      borderBottomWidth: w,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
    },
  });
  return (
    <View style={styles.box}>
      <View style={styles.chevron} />
    </View>
  );
}

/** List: three 11-unit lines, each with a dot before it. */
export function ListGlyph({ color }: { color: string }) {
  const s = iconSize.viewToggle;
  const k = s / GRID;
  const w = STROKE * k;
  const rows = [6, 12, 18];
  const styles = StyleSheet.create({
    box: { width: s, height: s },
    // Round-capped, so a line reaches half a stroke past its 9..20 span.
    line: {
      position: 'absolute',
      left: 9 * k - w / 2,
      width: 11 * k + w,
      height: w,
      borderRadius: w / 2,
      backgroundColor: color,
    },
    dot: {
      position: 'absolute',
      left: 4.5 * k - w / 2,
      width: w,
      height: w,
      borderRadius: w / 2,
      backgroundColor: color,
    },
  });
  return (
    <View style={styles.box}>
      {rows.map((y) => (
        <View key={y} style={[styles.line, { top: y * k - w / 2 }]} />
      ))}
      {rows.map((y) => (
        <View key={y} style={[styles.dot, { top: y * k - w / 2 }]} />
      ))}
    </View>
  );
}

/** Grid: four 7-unit rounded squares, two by two. */
export function GridGlyph({ color }: { color: string }) {
  const s = iconSize.viewToggle;
  const k = s / GRID;
  // The board strokes these at 2, a hair under the other marks.
  const w = 2 * k;
  const side = 7 * k + w;
  const styles = StyleSheet.create({
    box: { width: s, height: s },
    square: {
      position: 'absolute',
      width: side,
      height: side,
      borderWidth: w,
      borderRadius: 1.5 * k + w / 2,
      borderColor: color,
    },
  });
  return (
    <View style={styles.box}>
      {[4, 13].flatMap((y) =>
        [4, 13].map((x) => (
          <View
            key={`${x}-${y}`}
            style={[styles.square, { left: x * k - w / 2, top: y * k - w / 2 }]}
          />
        )),
      )}
    </View>
  );
}
