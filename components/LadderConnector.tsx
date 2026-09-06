import { StyleSheet, View } from 'react-native';
import { borderWidths, colors, sizes } from '@/theme/tokens';

interface LadderConnectorProps {
  /** Whether this segment leads into a rung the player can still play —
   *  cleared or the current frontier — versus one still behind a lock. */
  active: boolean;
}

// One spine segment between two difficulty rungs. Drawn only in the gap,
// never behind a badge: a short pill centred in the same fixed-width column
// the badges sit in, so it lines up with them regardless of level. Coloured
// per segment — accent up to the next playable rung, border beyond it —
// rather than one continuous line, so the ladder reads as "how far you've
// gotten" instead of a decorative rail.
export function LadderConnector({ active }: LadderConnectorProps) {
  return (
    <View style={styles.row}>
      <View style={styles.column}>
        <View
          style={[styles.segment, { backgroundColor: active ? colors.accent : colors.border }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  column: {
    width: sizes.difficultyBadgeColumn,
    alignItems: 'center',
    flexShrink: 0,
  },
  segment: {
    width: borderWidths.emphasis,
    height: sizes.difficultyConnectorHeight,
    borderRadius: borderWidths.emphasis,
  },
});
