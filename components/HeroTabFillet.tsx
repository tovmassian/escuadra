import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface HeroTabFilletProps {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

// A concave corner: a `size` square filled with `color` except for a quarter
// circle centred on its top-right corner. Two of these join the photo hero's
// number tab to the card edge in one continuous curve. Plain views, no SVG:
// a ring whose hole is that quarter circle, clipped to the square. The ring
// is as thick as its hole's radius, so it covers the square's far corner
// (√2·size from the centre) with room to spare.
export function HeroTabFillet({ size, color, style }: HeroTabFilletProps) {
  const styles = StyleSheet.create({
    clip: { width: size, height: size, overflow: 'hidden', pointerEvents: 'none' },
    ring: {
      position: 'absolute',
      left: -size,
      top: -2 * size,
      width: 4 * size,
      height: 4 * size,
      borderRadius: 2 * size,
      borderWidth: size,
      borderColor: color,
    },
  });
  return (
    <View style={[styles.clip, style]}>
      <View style={styles.ring} />
    </View>
  );
}
