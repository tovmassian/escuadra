import { CloseGlyph, ShareGlyph } from '@/components/ActionGlyphs';
import { ShareCard } from '@/components/ShareCard';
import { releaseShareImage, shareImage, shareText } from '@/lib/share';
import {
  formatShareText,
  shareCardView,
  shareTextParts,
  type ShareCardInput,
  type ShareFormat,
  type ShareInput,
} from '@/lib/shareResult';
import {
  durations,
  elevation,
  opacity,
  radii,
  shareCapture,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { TeamMarker } from '@/types/squad';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  /** What the picture is drawn from, and the team's bands for its top edge. */
  card: ShareCardInput & { marker: TeamMarker };
  /** What the message is written from. */
  text: ShareInput;
  /** A share menu has closed after `format` was handed to it. */
  onShared: (format: ShareFormat) => void;
}

// The share sheet (spec §4.1): a title, an Image / Text switch, a live preview
// of what will be sent, and the one button that hands it to the phone's own
// share menu. Image previews the card; Text previews the message as a chat
// bubble.
//
// The picture the button sends is not the preview. The preview is a scaled
// copy for the eye, and capturing a scaled view would capture the scale; so
// while Image is chosen a second `ShareCard` sits off screen, laid out at
// `shareCapture`'s 1,080 x 1,920 pixels (its width in points is that over the
// pixel ratio), and that view is what `shareImage` captures at its native size.
//
// The sheet stays open after a share. Expo cannot say whether a picture was
// sent, so closing on resolve would close it on a cancel too, and a player
// often wants to send the other format as well. Closing is one tap.
//
// The body mounts only while the sheet is open, so every opening starts on
// Image, with nothing in flight.
//
// The sheet is capped at the screen's height less the top inset and a margin,
// because at large text sizes or on a short screen it is taller than that, and
// a bottom-pinned sheet taller than the screen loses its handle and its close
// button off the top, with no way to dismiss it. The handle, the title with its
// close button and the share button stay put; the switch, the preview and the
// hint between them scroll.
export function ShareSheet({ visible, onClose, card, text, onShared }: ShareSheetProps) {
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
      {visible ? <SheetBody onClose={onClose} card={card} text={text} onShared={onShared} /> : null}
    </Modal>
  );
}

function SheetBody({ onClose, card, text, onShared }: Omit<ShareSheetProps, 'visible'>) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [format, setFormat] = useState<ShareFormat>('image');
  const [busy, setBusy] = useState(false);
  // The guard `submit` actually checks: state is a render behind, so two taps in
  // one frame would both pass it. `busy` only drives how the sheet draws.
  const sharing = useRef(false);
  // The switch's inner width, so the pill can be half of it and slide by that.
  const [switchWidth, setSwitchWidth] = useState(0);
  const cardRef = useRef<View>(null);
  const pillX = useSharedValue(0);

  // The picture's last capture is released with the sheet, not right after
  // it is shared: a target app can still be reading it.
  useEffect(() => () => releaseShareImage(), []);

  const pillWidth = switchWidth / 2;
  useEffect(() => {
    const target = format === 'text' ? pillWidth : 0;
    pillX.value = reduced ? target : withTiming(target, { duration: durations.toggle });
  }, [format, pillWidth, reduced, pillX]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  const view = shareCardView(card);
  const parts = shareTextParts(text);

  const sheet = sizes.shareSheet;
  const captureWidth = shareCapture.width / PixelRatio.get();
  // The close button and the switch's segments are drawn under the 44 pt tap
  // target, and reach it through hitSlop.
  const closeSlop = (sizes.minTapTarget - sheet.close) / 2;
  const segmentSlop = (sizes.minTapTarget - sheet.switchHeight) / 2;

  const styles = StyleSheet.create({
    root: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.sheet,
      borderTopRightRadius: radii.sheet,
      paddingTop: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.sm,
      gap: spacing.md,
      maxHeight: windowHeight - insets.top - spacing.md,
    },
    handle: {
      alignSelf: 'center',
      width: sheet.handleWidth,
      height: sheet.handleHeight,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
    },
    // Shrinks, and scrolls, when the sheet is capped.
    body: { flexShrink: 1 },
    bodyContent: { gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...typography.sheetTitle, flex: 1, minWidth: 0, color: colors.textPrimary },
    close: {
      width: sheet.close,
      height: sheet.close,
      borderRadius: sheet.close / 2,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // `surfaceRaised`, not `tile`: the light palette's `tile` is white, the
    // sheet's own colour, so a track and a close button filled with it vanish.
    track: {
      padding: spacing.xxs,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceRaised,
    },
    segments: { flexDirection: 'row' },
    pill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: pillWidth,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
    },
    segment: {
      flex: 1,
      height: sheet.switchHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentLabel: { ...typography.switchLabel },
    preview: { height: sheet.previewHeight, alignItems: 'center', justifyContent: 'center' },
    previewItem: { width: '100%', alignItems: 'center' },
    // The shadow sits on the frame and the clip on the card's own wrapper: on
    // iOS a view that clips its corners clips its shadow with them.
    frame: {
      width: sheet.previewWidth,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      ...elevation.e2,
    },
    frameClip: { borderRadius: radii.lg, overflow: 'hidden' },
    bubble: {
      width: '100%',
      maxWidth: sheet.bubbleMaxWidth,
      padding: spacing.sm,
      gap: spacing.xxs,
      backgroundColor: colors.surfaceRaised,
      borderRadius: radii.lg,
      borderBottomLeftRadius: radii.bubbleTail,
    },
    bubbleText: { ...typography.bubbleText, color: colors.textPrimary },
    bubbleScore: { ...typography.bubbleScore, color: colors.textPrimary },
    // The score, the verdict and the squares share a line, and wrap onto the
    // next when the bubble is too narrow for all three.
    bubbleResult: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: spacing.xs,
      rowGap: spacing.xxs,
    },
    squares: { flexDirection: 'row', gap: sheet.squareGap },
    square: { width: sheet.square, height: sheet.square, borderRadius: radii.xs },
    bubbleLink: { ...typography.bubbleLink, color: colors.link },
    bubbleMeta: { ...typography.bubbleMeta, alignSelf: 'flex-end', color: colors.textSecondary },
    // Two lines of room, so the sheet does not change height between formats:
    // the Image hint takes two lines, the Text hint one, centred in the slot.
    hintSlot: { minHeight: 2 * typography.sheetHint.lineHeight, justifyContent: 'center' },
    hint: { ...typography.sheetHint, textAlign: 'center', color: colors.textMuted },
    cta: {
      minHeight: sizes.cta.normal,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.ctaBg,
    },
    ctaText: { ...typography.ctaLabel, color: colors.ctaText },
    // Where `shareImage` captures from: out of sight, out of reach.
    capture: { position: 'absolute', top: 0, left: -2 * captureWidth },
  });

  const submit = async () => {
    if (sharing.current) return;
    sharing.current = true;
    setBusy(true);
    try {
      const sent =
        format === 'image' ? await shareImage(cardRef) : await shareText(formatShareText(text));
      if (sent) onShared(format);
    } catch {
      // A share menu that fails to open is not worth interrupting the results.
    } finally {
      sharing.current = false;
      setBusy(false);
    }
  };

  const formats: { key: ShareFormat; label: string }[] = [
    { key: 'image', label: 'Image' },
    { key: 'text', label: 'Text' },
  ];
  const bubbleLabel = `${parts.header}. ${parts.score}${parts.verdict ? `, ${parts.verdict}` : ''}. ${parts.url}`;

  return (
    <View style={styles.root}>
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

      <Animated.View
        testID="share-sheet"
        // A timing slide with no spring, so the sheet never overshoots.
        entering={
          reduced ? FadeIn.duration(durations.transition) : SlideInDown.duration(durations.sheet)
        }
        style={styles.sheet}
        accessibilityViewIsModal
        // iOS's two-finger scrub, since the scrim is hidden from screen readers.
        onAccessibilityEscape={onClose}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Share your round
          </Text>
          <Pressable
            testID="share-close"
            onPress={onClose}
            hitSlop={closeSlop}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.close, pressed && { opacity: opacity.settled }]}
          >
            <CloseGlyph color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.track} accessibilityRole="tablist">
            <View
              style={styles.segments}
              onLayout={(e) => setSwitchWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View style={[styles.pill, pillStyle]} />
              {formats.map(({ key, label }) => {
                const selected = format === key;
                return (
                  <Pressable
                    key={key}
                    testID={`share-format-${key}`}
                    onPress={() => setFormat(key)}
                    // Locked while a share is in flight, so the capture copy
                    // cannot unmount under `captureRef`.
                    disabled={busy}
                    hitSlop={{ top: segmentSlop, bottom: segmentSlop }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected, disabled: busy }}
                    style={styles.segment}
                  >
                    <Text
                      style={[
                        styles.segmentLabel,
                        { color: selected ? colors.ctaText : colors.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.preview}>
            <Animated.View
              key={format}
              entering={FadeIn.duration(durations.transition)}
              style={styles.previewItem}
            >
              {format === 'image' ? (
                <View style={styles.frame}>
                  <View style={styles.frameClip}>
                    <ShareCard
                      view={view}
                      items={card.items}
                      marker={card.marker}
                      width={sheet.previewWidth}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.bubble} accessible accessibilityLabel={bubbleLabel}>
                  <Text style={styles.bubbleText}>{parts.header}</Text>
                  <View style={styles.bubbleResult}>
                    <Text style={styles.bubbleScore}>{parts.score}</Text>
                    {parts.verdict ? <Text style={styles.bubbleText}>{parts.verdict}</Text> : null}
                    <View style={styles.squares}>
                      {parts.squares.map((right, i) => (
                        <View
                          key={i}
                          style={[
                            styles.square,
                            { backgroundColor: right ? colors.success : colors.error },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.bubbleLink}>{parts.url}</Text>
                  <Text style={styles.bubbleMeta}>Preview</Text>
                </View>
              )}
            </Animated.View>
          </View>

          <View style={styles.hintSlot}>
            <Text style={styles.hint}>
              {format === 'image'
                ? 'Story-sized picture. No player photos, no names — friends can still play it.'
                : 'The score grid for group chats, with a link to the app.'}
            </Text>
          </View>
        </ScrollView>

        <Pressable
          testID="share-submit"
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          style={({ pressed }) => [
            styles.cta,
            busy ? { opacity: opacity.disabled } : pressed && { opacity: opacity.settled },
          ]}
        >
          <ShareGlyph color={colors.ctaText} />
          <Text style={styles.ctaText}>{format === 'image' ? 'Share image' : 'Share text'}</Text>
        </Pressable>
      </Animated.View>

      {format === 'image' ? (
        <View
          style={styles.capture}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ShareCard
            ref={cardRef}
            view={view}
            items={card.items}
            marker={card.marker}
            width={captureWidth}
          />
        </View>
      ) : null}
    </View>
  );
}
