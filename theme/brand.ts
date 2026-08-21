// The Escuadra mark — direction "2a / La Escuadra" from the Claude Design
// logo iteration. A right angle opening down-left with the ball nested inside
// it: the goal frame's top corner, the escuadra a perfect shot finds.
//
// Coordinates are in a 64-unit grid, transcribed from the design source.
// Consumers scale by `size / MARK_VIEWBOX`. Deliberately axis-aligned
// rectangles plus one circle, so the mark renders in plain React Native
// <View>s — no react-native-svg, no Metro SVG transformer.
//
// The trail is part of the full lockup only. Icon plates drop it: at 29px
// the two squares close up into noise.

export const MARK_VIEWBOX = 64;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const markGeometry = {
  crossbar: { x: 14, y: 10, w: 40, h: 10 } as Rect,
  post: { x: 44, y: 10, w: 10, h: 40 } as Rect,
  ball: { cx: 35, cy: 31, r: 9 },
  trail: [
    { x: 16, y: 44, size: 7, opacity: 0.55 },
    { x: 5, y: 53, size: 5, opacity: 0.3 },
  ],
} as const;
