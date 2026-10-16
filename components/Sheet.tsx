import { CloseGlyph } from '@/components/ActionGlyphs';
import { durations, opacity, radii, sheetDrag, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type EntryAnimationsValues,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Names the sheet `<testID>-sheet` and its close button `<testID>-close`. */
  testID: string;
  /**
   * What the sheet holds, under its title, in a column `spacing.md` apart. A
   * part that should scroll when the sheet is capped is a ScrollView with
   * `flexShrink: 1`.
   */
  children: ReactNode;
}

const SHEET_MS = durations.sheet;

// The sheet rising from below. It moves the sheet's transform, never its frame:
// Reanimated's `SlideInDown` animates the frame, and inside an Android Modal
// that frame comes to rest above the layout by the screen's height less the
// window's (the status and navigation bars). The sheet was drawn there while
// React Native's touch handling still placed it at its layout, so a tap on the
// × that moved at all was taken for a slide off it and cancelled, and a strip
// of page showed under the sheet. A transform comes to rest at the layout.
function slideUp(values: EntryAnimationsValues) {
  'worklet';
  return {
    initialValues: { transform: [{ translateY: values.targetHeight }] },
    animations: { transform: [{ translateY: withTiming(0, { duration: SHEET_MS }) }] },
  };
}

// A bottom sheet over the screen: a handle, a title with a close button, and
// what the caller puts under them. The share sheet and the photo credits are
// both one, so they open, look and close alike. It closes from the ×, a tap on
// the backdrop, Android's back button, or a drag down on the handle or title.
//
// The children mount only while the sheet is open, so state kept inside them
// starts fresh at every opening.
//
// The sheet is as tall as what it holds, capped at the Modal's height less the
// top inset and a margin, because at large text sizes or on a short screen it
// is taller than that, and a bottom-pinned sheet taller than the screen loses
// its handle and its close button off the top, with no way to dismiss it. Under
// the cap, the child that shrinks scrolls.
export function Sheet({ visible, onClose, title, testID, children }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      // Android's back button.
      onRequestClose={onClose}
    >
      {visible ? (
        <SheetFrame onClose={onClose} title={title} testID={testID}>
          {children}
        </SheetFrame>
      ) : null}
    </Modal>
  );
}

function SheetFrame({ onClose, title, testID, children }: Omit<SheetProps, 'visible'>) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  // The Modal's own height. On Android it reaches under the status and
  // navigation bars, so it is taller than the window, and the cap is measured
  // against it; the window's height stands in until it is laid out.
  const [rootHeight, setRootHeight] = useState(windowHeight);

  // How far the sheet is dragged down, and its height, against which a drag is
  // far enough to close it.
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  // A drag that closes the sheet sets this, and the effect below closes it, so
  // the responder is made once, with nothing in it to go stale, and keeps its
  // gesture through a re-render. Reduce Motion is read once, as Reanimated does.
  const [dragged, setDragged] = useState(false);
  useEffect(() => {
    if (dragged) onClose();
  }, [dragged, onClose]);
  const [pan] = useState(() =>
    PanResponder.create({
      // Down and more down than across; a tap, the × included, stays a tap.
      onMoveShouldSetPanResponder: (_e, g) =>
        g.dy > sheetDrag.slop && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        dragY.set(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        const far = g.dy > sheetHeight.get() * sheetDrag.closeFraction;
        if (!far && g.vy <= sheetDrag.flingVelocity) {
          dragY.set(reduced ? 0 : withTiming(0, { duration: SHEET_MS }));
        } else if (reduced) {
          setDragged(true);
        } else {
          dragY.set(
            withTiming(sheetHeight.get(), { duration: SHEET_MS }, (done) => {
              if (done) scheduleOnRN(setDragged, true);
            }),
          );
        }
      },
      onPanResponderTerminate: () => {
        dragY.set(withTiming(0, { duration: SHEET_MS }));
      },
    }),
  );
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  const sheet = sizes.sheet;
  // The close button is drawn under the 44 pt tap target, and reaches it
  // through hitSlop.
  const closeSlop = (sizes.minTapTarget - sheet.close) / 2;

  const styles = StyleSheet.create({
    root: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.sheet,
      borderTopRightRadius: radii.sheet,
      paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.sm,
      gap: spacing.md,
      maxHeight: rootHeight - insets.top - spacing.md,
    },
    // The handle and the title row, which a drag down takes hold of.
    grab: { paddingTop: spacing.xs, gap: spacing.md },
    handle: {
      alignSelf: 'center',
      width: sheet.handleWidth,
      height: sheet.handleHeight,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...typography.sheetTitle, flex: 1, minWidth: 0, color: colors.textPrimary },
    // `surfaceRaised`, not `tile`: the light palette's `tile` is white, the
    // sheet's own colour, so a close button filled with it vanishes.
    close: {
      width: sheet.close,
      height: sheet.close,
      borderRadius: sheet.close / 2,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={styles.root} onLayout={(e) => setRootHeight(e.nativeEvent.layout.height)}>
      <Animated.View
        entering={FadeIn.duration(reduced ? durations.transition : durations.scrim)}
        style={styles.scrim}
      >
        {/* A tap outside closes the sheet, but the scrim is left out of the
            screen reader's order: the × and Android's back button are the
            accessible ways out, and a second "Close" would be read twice (on
            Android `accessibilityViewIsModal` does nothing). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          focusable={false}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      </Animated.View>

      {/* The drag moves this wrapper and the slide-in moves the sheet inside
          it, so neither transform overwrites the other. */}
      <Animated.View
        style={dragStyle}
        onLayout={(e) => {
          sheetHeight.set(e.nativeEvent.layout.height);
        }}
        accessibilityViewIsModal
        // iOS's two-finger scrub, since the scrim is hidden from screen readers.
        onAccessibilityEscape={onClose}
      >
        <Animated.View
          testID={`${testID}-sheet`}
          entering={reduced ? FadeIn.duration(durations.transition) : slideUp}
          style={styles.sheet}
        >
          <View style={styles.grab} {...pan.panHandlers}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              <Pressable
                testID={`${testID}-close`}
                onPress={onClose}
                hitSlop={closeSlop}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [styles.close, pressed && { opacity: opacity.settled }]}
              >
                <CloseGlyph color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
