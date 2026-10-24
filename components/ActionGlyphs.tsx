import { StyleSheet, View } from 'react-native';
import { borderWidths, iconSize, radii } from '@/theme/tokens';

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

/** Eraser (#197): Start over and Clear all scores. A block leaning 45°, its
 *  rubber end filled, on a baseline. Not `RetryGlyph`, which means replay. */
export function EraserGlyph({ color }: { color: string }) {
  const s = iconSize.eraserGlyph;
  const w = borderWidths.thick + borderWidths.hairline / 2;
  const blockW = s * 0.42;
  const blockH = s * 0.74;
  // The turned block reaches this far above and below its centre, which sits so its lowest
  // corner rests on the baseline's top edge.
  const reach = ((blockW + blockH) / 2) * Math.SQRT1_2;
  const styles = StyleSheet.create({
    box: { width: s, height: s },
    block: {
      position: 'absolute',
      left: (s - blockW) / 2,
      top: s - w - reach - blockH / 2,
      width: blockW,
      height: blockH,
      borderRadius: radii.xs,
      borderWidth: w,
      borderColor: color,
      overflow: 'hidden',
      transform: [{ rotate: '45deg' }],
    },
    rubber: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: blockH * 0.36,
      backgroundColor: color,
    },
    base: {
      position: 'absolute',
      left: s * 0.08,
      right: s * 0.08,
      bottom: 0,
      height: w,
      borderRadius: w / 2,
      backgroundColor: color,
    },
  });
  return (
    <View style={styles.box}>
      <View style={styles.block}>
        <View style={styles.rubber} />
      </View>
      <View style={styles.base} />
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

/** Play: a solid triangle pointing right, 14 units across and 16 down, drawn
 *  from one zero-size View's borders and centred in its box. */
export function PlayGlyph({ color }: { color: string }) {
  const s = iconSize.play;
  const k = s / GRID;
  const styles = StyleSheet.create({
    box: { width: s, height: s, alignItems: 'center', justifyContent: 'center' },
    triangle: {
      width: 0,
      height: 0,
      borderLeftWidth: 14 * k,
      borderLeftColor: color,
      borderTopWidth: 8 * k,
      borderTopColor: 'transparent',
      borderBottomWidth: 8 * k,
      borderBottomColor: 'transparent',
    },
  });
  return (
    <View style={styles.box}>
      <View style={styles.triangle} />
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

// The star's points on the 24-unit grid, as the design board draws it: five
// tips 10.5 units from (12, 12.5), the notches between them at 5.2.
const STAR = { cx: 12, cy: 12.5, outer: 10.5, inner: 5.2 };
const TIP_HALF = STAR.inner * Math.sin(Math.PI / 5);
const TIP_HEIGHT = STAR.outer - STAR.inner * Math.cos(Math.PI / 5);

/** The ten corners, tip first, clockwise from the top. */
function starPoints(): { x: number; y: number }[] {
  return Array.from({ length: 10 }, (_, j) => {
    const angle = -Math.PI / 2 + (j * Math.PI) / 5;
    const radius = j % 2 === 0 ? STAR.outer : STAR.inner;
    return { x: STAR.cx + radius * Math.cos(angle), y: STAR.cy + radius * Math.sin(angle) };
  });
}

/** Star: Your squads' mark (#179). Filled, a disc through the notches under
 *  five tip triangles, each a View's bottom border turned about the centre;
 *  outlined, ten round-capped strokes, whose caps make the round joins. */
export function StarGlyph({
  color,
  filled,
  size = iconSize.star,
}: {
  color: string;
  filled: boolean;
  size?: number;
}) {
  const k = size / GRID;
  const w = 2 * k;
  const reach = STAR.outer * k;
  const styles = StyleSheet.create({
    box: { width: size, height: size },
    disc: {
      position: 'absolute',
      left: (STAR.cx - STAR.inner) * k,
      top: (STAR.cy - STAR.inner) * k,
      width: 2 * STAR.inner * k,
      height: 2 * STAR.inner * k,
      borderRadius: STAR.inner * k,
      backgroundColor: color,
    },
    // A square on the star's centre: turning it turns a tip about that centre.
    turn: {
      position: 'absolute',
      left: STAR.cx * k - reach,
      top: STAR.cy * k - reach,
      width: 2 * reach,
      height: 2 * reach,
    },
    tip: {
      position: 'absolute',
      left: reach - TIP_HALF * k,
      top: 0,
      width: 0,
      height: 0,
      borderLeftWidth: TIP_HALF * k,
      borderRightWidth: TIP_HALF * k,
      borderBottomWidth: TIP_HEIGHT * k,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: color,
    },
    stroke: { position: 'absolute', height: w, borderRadius: w / 2, backgroundColor: color },
  });

  if (filled) {
    return (
      <View style={styles.box}>
        <View style={styles.disc} />
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.turn, { transform: [{ rotate: `${i * 72}deg` }] }]}>
            <View style={styles.tip} />
          </View>
        ))}
      </View>
    );
  }

  const points = starPoints();
  return (
    <View style={styles.box}>
      {points.map((from, j) => {
        const to = points[(j + 1) % points.length] ?? from;
        const length = Math.hypot(to.x - from.x, to.y - from.y) * k + w;
        return (
          <View
            key={j}
            style={[
              styles.stroke,
              {
                width: length,
                left: ((from.x + to.x) / 2) * k - length / 2,
                top: ((from.y + to.y) / 2) * k - w / 2,
                transform: [{ rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** Clock: the outdated-score mark (#180), a ring with its two hands at ten
 *  past, on the board's 24-unit grid at a 2.5-unit stroke. */
export function OutdatedGlyph({ color, size }: { color: string; size: number }) {
  const k = size / GRID;
  const w = 2.5 * k;
  const styles = StyleSheet.create({
    box: { width: size, height: size },
    ring: {
      position: 'absolute',
      left: 3 * k - w / 2,
      top: 3 * k - w / 2,
      width: 18 * k + w,
      height: 18 * k + w,
      borderRadius: (18 * k + w) / 2,
      borderWidth: w,
      borderColor: color,
    },
    // Each hand starts at the centre (12, 12) and is as wide as the stroke.
    minute: {
      position: 'absolute',
      left: 12 * k - w / 2,
      top: 7 * k - w / 2,
      width: w,
      height: 5 * k + w,
      borderRadius: w / 2,
      backgroundColor: color,
    },
    hour: {
      position: 'absolute',
      left: 12 * k - w / 2,
      top: 12 * k - w / 2,
      width: 3.5 * k + w,
      height: w,
      borderRadius: w / 2,
      backgroundColor: color,
    },
  });
  return (
    <View
      style={styles.box}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.ring} />
      <View style={styles.minute} />
      <View style={styles.hour} />
    </View>
  );
}
