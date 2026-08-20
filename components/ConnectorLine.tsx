import React from 'react';
import { StyleSheet, View } from 'react-native';
import { borderWidths, colors } from '@/theme/tokens';

// Decorative vertical line behind the difficulty ladder's rows. Positioned
// by the parent (absolute, matching the badge column) — this just draws it.
export function ConnectorLine() {
  return <View style={styles.line} />;
}

const styles = StyleSheet.create({
  line: { flex: 1, width: borderWidths.emphasis, backgroundColor: colors.surfaceRaised },
});
