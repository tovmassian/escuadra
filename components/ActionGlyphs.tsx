import { StyleSheet, View } from 'react-native';
import { borderWidths, iconSize } from '@/theme/tokens';

// Glyphs for Results' icon buttons, drawn from Views as SearchField does. No
// icon library: one font load and one dependency for three marks isn't worth it.

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
