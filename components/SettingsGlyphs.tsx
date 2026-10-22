import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { sizes } from '@/theme/tokens';

// Settings' row marks and Home's gear (#175), drawn from Views on the design
// board's 24-unit grid at its 2-unit stroke, as ActionGlyphs.tsx draws Study's.
// No icon library: an icon set is a new asset licence (docs/license.md).
const GRID = 24;
const S = sizes.settings.glyph;
const k = S / GRID;
const w = 2 * k;

/** A box in grid units, for the absolutely placed parts of a glyph. */
function at(x: number, y: number, width: number, height: number): ViewStyle {
  return { position: 'absolute', left: x * k, top: y * k, width: width * k, height: height * k };
}

function Box({ children }: { children: ReactNode }) {
  return <View style={styles.box}>{children}</View>;
}

/** A circle of diameter `d` centred on (cx, cy), stroked or filled. */
function circle(cx: number, cy: number, d: number, color: string, fill = false): ViewStyle {
  return {
    ...at(cx - d / 2, cy - d / 2, d, d),
    borderRadius: (d * k) / 2,
    ...(fill ? { backgroundColor: color } : { borderWidth: w, borderColor: color }),
  };
}

export function GearGlyph({ color, ground }: { color: string; ground: string }) {
  // Eight teeth (four bars through the centre), a disc over them, and the hub's
  // hole punched out in the ground's colour.
  return (
    <Box>
      {[0, 45, 90, 135].map((deg) => (
        <View
          key={deg}
          style={[
            at(10, 2, 4, 20),
            { backgroundColor: color, borderRadius: k, transform: [{ rotate: `${deg}deg` }] },
          ]}
        />
      ))}
      <View style={circle(12, 12, 16, color, true)} />
      <View style={circle(12, 12, 7, ground, true)} />
    </Box>
  );
}

export function GlobeGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={circle(12, 12, 20, color)} />
      <View
        style={[at(7.5, 2, 9, 20), { borderRadius: 10 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(2, 11, 20, 2), { backgroundColor: color }]} />
    </Box>
  );
}

export function MoonGlyph({ color, ground }: { color: string; ground: string }) {
  // A disc with an offset disc in the ground's colour punched out of it.
  return (
    <Box>
      <View style={[circle(12, 12, 18, color, true), { overflow: 'hidden' }]}>
        <View style={[at(7, -4, 16, 16), { borderRadius: 8 * k, backgroundColor: ground }]} />
      </View>
    </Box>
  );
}

export function VibrationGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View
        style={[at(8, 4, 8, 16), { borderRadius: 2 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(3, 9, 2, 6), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(19, 9, 2, 6), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function ChartGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={[at(3, 19, 18, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(5, 11, 2, 6), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(10, 5, 2, 12), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(15, 8, 2, 9), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function InfoGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={circle(12, 12, 20, color)} />
      <View style={[at(11, 7, 2, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(11, 11, 2, 6), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function DocumentGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View
        style={[at(5, 3, 14, 18), { borderRadius: 2 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(9, 9, 6, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(9, 13, 6, 2), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function BookGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View
        style={[at(4, 3, 16, 18), { borderRadius: 2 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(8, 3, 2, 18), { backgroundColor: color }]} />
    </Box>
  );
}

export function ClockGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={[at(9, 1, 6, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={circle(12, 13, 17, color)} />
      <View style={[at(11, 8.5, 2, 5.5), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(11, 12, 4.5, 2), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

/** A chevron pointing right (›), at `sizes.settings.chevron`. */
export function ChevronGlyph({ color }: { color: string }) {
  const c = sizes.settings.chevron;
  const arm = c * 0.42;
  const stroke = (2.5 * c) / GRID;
  return (
    <View style={{ width: c, height: c, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: arm,
          height: arm,
          marginLeft: -arm / 3,
          borderTopWidth: stroke,
          borderRightWidth: stroke,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ box: { width: S, height: S } });
